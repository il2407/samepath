import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";

/**
 * These tests need to inject controlled, deterministic failures into a
 * single user's unit of work (a transient error that clears after N
 * attempts, or one that never clears) — something the real
 * generateSuggestionsForUser has no way to simulate on demand. So this file
 * mocks @/modules/matching/service, unlike job.integration.test.ts, which
 * deliberately uses the real thing to prove end-to-end wiring. Splitting
 * across two files (rather than one) avoids vi.mock's hoisting silently
 * turning every test in the file into a mocked one.
 *
 * The DB is still real here: JobRun rows, and the ProfessionalProfile rows
 * job.ts pages through to decide which user IDs to call
 * generateSuggestionsForUser for, are exactly the same real Prisma models
 * used everywhere else — only the mocked function's *behavior* is
 * substituted.
 */

const sentMail: { to: string }[] = [];
const mailerSendMock = vi.fn(async (message: { to: string }) => {
  sentMail.push(message);
});
vi.mock("@/modules/notifications/mailer", () => ({
  getMailer: () => ({ send: (message: { to: string }) => mailerSendMock(message) }),
}));

const generateSuggestionsForUserMock = vi.fn<(userId: string) => Promise<number>>();
vi.mock("@/modules/matching/service", () => ({
  generateSuggestionsForUser: (userId: string) => generateSuggestionsForUserMock(userId),
}));

const { runMatchingJob, MATCHING_JOB_NAME } = await import("@/modules/matching/job");

beforeEach(async () => {
  await resetTestDatabase();
  sentMail.length = 0;
  generateSuggestionsForUserMock.mockReset();
  mailerSendMock.mockReset();
  mailerSendMock.mockImplementation(async (message: { to: string }) => {
    sentMail.push(message);
  });
});

async function createEligibleUser() {
  // No professionalField/targetRole/scoring fixtures needed here —
  // generateSuggestionsForUser itself is mocked, so job.ts's batch query
  // (ProfessionalProfile where status: ACTIVE) is the only real behavior
  // being exercised against these rows.
  return createTestUser();
}

describe("runMatchingJob — retry on transient failure", () => {
  it("recovers a user whose unit of work fails once or twice before succeeding, with no failure recorded", async () => {
    const user = await createEligibleUser();

    let calls = 0;
    generateSuggestionsForUserMock.mockImplementation(async () => {
      calls += 1;
      if (calls < 3) throw new Error("transient: connection reset");
      return 2;
    });

    const summary = await runMatchingJob();

    expect(calls).toBe(3);
    expect(summary.status).toBe("SUCCESS");
    expect(summary.usersProcessed).toBe(1);
    expect(summary.matchesCreated).toBe(2);
    expect(summary.failedUserCount).toBe(0);

    const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: summary.jobRunId! } });
    expect(jobRun.status).toBe("SUCCESS");
    expect(jobRun.errorSummary).toBeNull();

    void user;
  });

  it("does not re-attempt the whole batch — a retried user's eventual success is not double-counted", async () => {
    const userA = await createEligibleUser();
    const userB = await createEligibleUser();
    const callsPerUser = new Map<string, number>();

    generateSuggestionsForUserMock.mockImplementation(async (userId: string) => {
      const n = (callsPerUser.get(userId) ?? 0) + 1;
      callsPerUser.set(userId, n);
      if (userId === userA.user.id && n === 1) throw new Error("transient blip");
      return 1;
    });

    const summary = await runMatchingJob();

    expect(summary.usersProcessed).toBe(2);
    expect(summary.matchesCreated).toBe(2); // 1 for A (after its retry) + 1 for B
    expect(summary.failedUserCount).toBe(0);
    expect(callsPerUser.get(userA.user.id)).toBe(2);
    expect(callsPerUser.get(userB.user.id)).toBe(1);
  });
});

describe("runMatchingJob — permanent failure recording", () => {
  it("records a user whose unit of work fails on every attempt, without aborting the rest of the batch", async () => {
    const failingUser = await createEligibleUser();
    const healthyUser = await createEligibleUser();

    generateSuggestionsForUserMock.mockImplementation(async (userId: string) => {
      if (userId === failingUser.user.id) {
        throw new Error("permanent: profile scoring lookup failed");
      }
      return 1;
    });

    const summary = await runMatchingJob();

    expect(summary.status).toBe("PARTIAL");
    expect(summary.usersProcessed).toBe(2);
    expect(summary.matchesCreated).toBe(1); // only the healthy user's
    expect(summary.failedUserCount).toBe(1);

    // Exhausted all 3 attempts for the failing user before giving up, but
    // called the healthy user exactly once — its own success on the first
    // try was never retried.
    const failingUserAttempts = generateSuggestionsForUserMock.mock.calls.filter(
      ([userId]) => userId === failingUser.user.id,
    ).length;
    const healthyUserAttempts = generateSuggestionsForUserMock.mock.calls.filter(
      ([userId]) => userId === healthyUser.user.id,
    ).length;
    expect(failingUserAttempts).toBe(3);
    expect(healthyUserAttempts).toBe(1);

    const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: summary.jobRunId! } });
    expect(jobRun.status).toBe("PARTIAL");
    expect(jobRun.failedUserCount).toBe(1);
    expect(jobRun.errorSummary).toContain(failingUser.user.id);
    // Safe failure detail only — never any profile/résumé content, just the
    // user id and a short error class/message.
    expect(jobRun.errorSummary).toContain("Error: permanent: profile scoring lookup failed");
  });

  it("marks the whole run FAILURE when every processed user fails", async () => {
    await createEligibleUser();
    await createEligibleUser();

    generateSuggestionsForUserMock.mockRejectedValue(new Error("db unreachable"));

    const summary = await runMatchingJob();

    expect(summary.status).toBe("FAILURE");
    expect(summary.usersProcessed).toBe(2);
    expect(summary.matchesCreated).toBe(0);
    expect(summary.failedUserCount).toBe(2);

    const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: summary.jobRunId! } });
    expect(jobRun.status).toBe("FAILURE");
    expect(jobRun.finishedAt).not.toBeNull();
  });

  it("records a notify-only failure separately from a suggestion-generation failure, without inflating failedUserCount", async () => {
    const user = await createEligibleUser();
    generateSuggestionsForUserMock.mockResolvedValue(1);

    // The mailer itself is mocked to always throw, simulating an SMTP
    // outage that outlasts every retry — suggestion creation still fully
    // succeeded (matchesCreated reflects that), only the email failed.
    mailerSendMock.mockRejectedValue(new Error("smtp timeout"));

    const summary = await runMatchingJob();

    expect(summary.status).toBe("PARTIAL");
    expect(summary.matchesCreated).toBe(1);
    expect(summary.notificationsSent).toBe(0);
    expect(summary.failedUserCount).toBe(0); // not a suggestion-generation failure

    const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: summary.jobRunId! } });
    expect(jobRun.errorSummary).toContain("notify:");
    expect(jobRun.errorSummary).toContain(user.user.id);
  });
});

describe("runMatchingJob — overlap guard reclaims a stale RUNNING row", () => {
  it("proceeds with a fresh run when the existing RUNNING row is old enough to be orphaned, marking the stale one FAILURE", async () => {
    await prisma.jobRun.create({
      data: {
        jobName: MATCHING_JOB_NAME,
        status: "RUNNING",
        startedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
    });
    generateSuggestionsForUserMock.mockResolvedValue(0);

    const summary = await runMatchingJob();

    expect(summary.status).toBe("SUCCESS");
    expect(summary.jobRunId).not.toBeNull();

    const rows = await prisma.jobRun.findMany({ where: { jobName: MATCHING_JOB_NAME }, orderBy: { startedAt: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("FAILURE");
    expect(rows[0].errorSummary).toContain("stale");
    expect(rows[1].status).toBe("SUCCESS");
  });

  it("skips a fresh RUNNING row instead of reclaiming it", async () => {
    await prisma.jobRun.create({
      data: { jobName: MATCHING_JOB_NAME, status: "RUNNING", startedAt: new Date() },
    });

    const summary = await runMatchingJob();

    expect(summary.status).toBe("SKIPPED_ALREADY_RUNNING");
    expect(summary.jobRunId).toBeNull();
    expect(await prisma.jobRun.count()).toBe(1);
    expect(generateSuggestionsForUserMock).not.toHaveBeenCalled();
  });
});
