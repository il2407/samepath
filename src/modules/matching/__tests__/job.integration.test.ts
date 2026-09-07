import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";

/**
 * Real generateSuggestionsForUser, real DB — this file proves job.ts is
 * correctly wired to the actual shared unit of work end-to-end (overlap
 * guard, batching, dedup against both itself and the manual "Find matches"
 * path, run bookkeeping). Fault-injection scenarios that need a controlled
 * failure (retry-on-transient-failure, permanent-failure recording) live in
 * job.retry.test.ts instead, where generateSuggestionsForUser is mocked —
 * mixing a module mock into this file would make vi.mock's hoisting also
 * intercept these real end-to-end tests.
 */

const sentMail: { to: string; subject: string; text: string }[] = [];
vi.mock("@/modules/notifications/mailer", () => ({
  getMailer: () => ({
    send: async (message: { to: string; subject: string; text: string }) => {
      sentMail.push(message);
    },
  }),
}));

const { runMatchingJob, MATCHING_JOB_NAME } = await import("@/modules/matching/job");
const { generateSuggestionsForUser } = await import("@/modules/matching/service");

beforeEach(async () => {
  await resetTestDatabase();
  sentMail.length = 0;
});

async function seedRole() {
  const field = await prisma.professionalField.create({
    data: { code: "software-engineering", labelHe: "x", labelEn: "x" },
  });
  const role = await prisma.targetRole.create({
    data: { code: "backend", professionalFieldId: field.id, labelHe: "Backend", labelEn: "Backend" },
  });
  return { field, role };
}

describe("runMatchingJob — successful run", () => {
  it("creates suggestions via the shared unit of work, records a SUCCESS JobRun, and emails both sides of each new suggestion", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    const b = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    const summary = await runMatchingJob();

    expect(summary.status).toBe("SUCCESS");
    expect(summary.jobRunId).not.toBeNull();
    expect(summary.usersProcessed).toBe(2);
    // a's turn creates the (a,b) pair; b's own turn then correctly finds it
    // already exists (generateSuggestionsForUser's own dedup) and creates
    // nothing new — so exactly one suggestion, not two.
    expect(summary.matchesCreated).toBe(1);
    expect(await prisma.matchSuggestion.count()).toBe(1);

    // Both the initiating subject (a) and the candidate on the other side
    // (b) get emailed, even though only a's call actually created the row.
    expect(summary.notificationsSent).toBe(2);
    expect(sentMail).toHaveLength(2);
    const recipients = sentMail.map((m) => m.to).sort();
    expect(recipients).toEqual([a.user.email, b.user.email].sort());

    const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: summary.jobRunId! } });
    expect(jobRun.jobName).toBe(MATCHING_JOB_NAME);
    expect(jobRun.status).toBe("SUCCESS");
    expect(jobRun.finishedAt).not.toBeNull();
    expect(jobRun.usersProcessed).toBe(2);
    expect(jobRun.matchesCreated).toBe(1);
    expect(jobRun.notificationsSent).toBe(2);
    expect(jobRun.failedUserCount).toBe(0);
    expect(jobRun.errorSummary).toBeNull();

    const notifLogs = await prisma.notificationLog.findMany({ where: { type: "NEW_MATCH_SUGGESTIONS" } });
    expect(notifLogs).toHaveLength(2);
  });
});

describe("runMatchingJob — no matches available", () => {
  it("completes as SUCCESS with all-zero counts when there are no eligible candidates", async () => {
    const summary = await runMatchingJob();

    expect(summary.status).toBe("SUCCESS");
    expect(summary.usersProcessed).toBe(0);
    expect(summary.matchesCreated).toBe(0);
    expect(summary.notificationsSent).toBe(0);
    expect(summary.failedUserCount).toBe(0);
    expect(sentMail).toHaveLength(0);
  });

  it("completes as SUCCESS with zero matches when the lone eligible user has no compatible candidate", async () => {
    const { field, role } = await seedRole();
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    const summary = await runMatchingJob();

    expect(summary.status).toBe("SUCCESS");
    expect(summary.usersProcessed).toBe(1);
    expect(summary.matchesCreated).toBe(0);
    expect(summary.notificationsSent).toBe(0);
    expect(sentMail).toHaveLength(0);
  });
});

describe("runMatchingJob — deduplication", () => {
  it("creates no duplicate MatchSuggestion rows across two back-to-back job runs", async () => {
    const { field, role } = await seedRole();
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    const first = await runMatchingJob();
    expect(first.matchesCreated).toBe(1);
    const countAfterFirst = await prisma.matchSuggestion.count();

    const second = await runMatchingJob();
    expect(second.matchesCreated).toBe(0);
    const countAfterSecond = await prisma.matchSuggestion.count();

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it("creates no duplicate MatchSuggestion rows when a job run is followed by the manual 'Find matches' call for the same user", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    await runMatchingJob();
    const countAfterJob = await prisma.matchSuggestion.count();
    expect(countAfterJob).toBe(1);

    // The manual button calls generateSuggestionsForUser directly — exactly
    // reproduced here, since refreshSuggestionsAction is just requireUser()
    // + this call.
    const manualCreated = await generateSuggestionsForUser(a.user.id);
    expect(manualCreated).toBe(0);
    expect(await prisma.matchSuggestion.count()).toBe(countAfterJob);
  });

  it("creates no duplicate MatchSuggestion rows when a manual call happens first and the job runs afterward", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    const manualCreated = await generateSuggestionsForUser(a.user.id);
    expect(manualCreated).toBe(1);
    const countAfterManual = await prisma.matchSuggestion.count();

    const summary = await runMatchingJob();
    expect(summary.matchesCreated).toBe(0);
    expect(await prisma.matchSuggestion.count()).toBe(countAfterManual);
  });
});

describe("runMatchingJob — concurrent execution", () => {
  it("only lets one of two overlapping triggers actually run — the other is skipped, and no data is duplicated or corrupted", async () => {
    const { field, role } = await seedRole();
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    const [resultA, resultB] = await Promise.all([runMatchingJob(), runMatchingJob()]);

    const statuses = [resultA.status, resultB.status].sort();
    // Exactly one of the two actually ran (SUCCESS) and the other was
    // turned away by the advisory-lock-guarded claim (SKIPPED_ALREADY_RUNNING).
    expect(statuses).toEqual(["SKIPPED_ALREADY_RUNNING", "SUCCESS"]);

    const skipped = resultA.status === "SKIPPED_ALREADY_RUNNING" ? resultA : resultB;
    expect(skipped.jobRunId).toBeNull();

    // Exactly one JobRun row exists, and the suggestion data is exactly what
    // a single successful run would produce — no duplication, no corruption.
    expect(await prisma.jobRun.count()).toBe(1);
    expect(await prisma.matchSuggestion.count()).toBe(1);
  });
});

// Each test below uses exactly one candidate pair per DB (beforeEach resets
// it). Deliberately not combining a "job pair" and a "manual pair" of users
// in the same test: generateSuggestionsForUser's candidate pool is every
// other ACTIVE profile with no cap on how many *other* users' own suggestion
// counts allow them to appear as a candidate, so a second unrelated pair
// present in the same run would be eligible cross-pair candidates too
// (tied scores, since these fixtures are otherwise identical), making
// "which two users actually matched" non-deterministic. One pair per test
// keeps every assertion below deterministic.
describe("runMatchingJob — manual/automatic consistency", () => {
  it("a suggestion created by the job has the expected shape: PROPOSED, a real score breakdown, a future expiry", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    await runMatchingJob();
    const viaJob = await prisma.matchSuggestion.findFirstOrThrow({
      where: { OR: [{ userAId: a.user.id }, { userBId: a.user.id }] },
      include: { scoreBreakdown: true },
    });

    expect(viaJob.status).toBe("PROPOSED");
    expect(viaJob.scoreBreakdown).not.toBeNull();
    expect(viaJob.scoreBreakdown!.weightsVersion).toBe("default-v1");
    expect(viaJob.scoreBreakdown!.totalScore).toBeGreaterThanOrEqual(0);
    expect(viaJob.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("a suggestion created by the manual button has the identical shape", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    await generateSuggestionsForUser(a.user.id);
    const viaManual = await prisma.matchSuggestion.findFirstOrThrow({
      where: { OR: [{ userAId: a.user.id }, { userBId: a.user.id }] },
      include: { scoreBreakdown: true },
    });

    expect(viaManual.status).toBe("PROPOSED");
    expect(viaManual.scoreBreakdown).not.toBeNull();
    expect(viaManual.scoreBreakdown!.weightsVersion).toBe("default-v1");
    expect(viaManual.scoreBreakdown!.totalScore).toBeGreaterThanOrEqual(0);
    expect(viaManual.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("job-created, then a manual call for the same pair: the original row and its score breakdown are untouched", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    await runMatchingJob();
    const before = await prisma.matchSuggestion.findFirstOrThrow({
      where: { OR: [{ userAId: a.user.id }, { userBId: a.user.id }] },
      include: { scoreBreakdown: true },
    });

    const manualCreated = await generateSuggestionsForUser(a.user.id);
    expect(manualCreated).toBe(0);

    const after = await prisma.matchSuggestion.findFirstOrThrow({
      where: { OR: [{ userAId: a.user.id }, { userBId: a.user.id }] },
      include: { scoreBreakdown: true },
    });
    expect(after.id).toBe(before.id);
    expect(after.scoreBreakdown!.totalScore).toBe(before.scoreBreakdown!.totalScore);
    expect(await prisma.matchSuggestion.count()).toBe(1);
  });

  it("manually created, then the job runs for the same pair: the original row and its score breakdown are untouched", async () => {
    const { field, role } = await seedRole();
    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });

    await generateSuggestionsForUser(a.user.id);
    const before = await prisma.matchSuggestion.findFirstOrThrow({
      where: { OR: [{ userAId: a.user.id }, { userBId: a.user.id }] },
      include: { scoreBreakdown: true },
    });

    const summary = await runMatchingJob();
    expect(summary.matchesCreated).toBe(0);

    const after = await prisma.matchSuggestion.findFirstOrThrow({
      where: { OR: [{ userAId: a.user.id }, { userBId: a.user.id }] },
      include: { scoreBreakdown: true },
    });
    expect(after.id).toBe(before.id);
    expect(after.scoreBreakdown!.totalScore).toBe(before.scoreBreakdown!.totalScore);
    expect(await prisma.matchSuggestion.count()).toBe(1);
  });
});
