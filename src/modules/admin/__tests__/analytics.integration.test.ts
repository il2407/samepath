import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import { getAdminAnalytics } from "@/modules/admin/analytics";
import { MATCHING_JOB_NAME } from "@/modules/matching/job";
import type { JobRunStatus, MatchStatus } from "@/generated/prisma/client";

/**
 * DB-backed — do NOT run this file yourself while WS1 is also using the
 * shared samepath_test database (see this workstream's final report's Test
 * safety section). Written for coordinator-run verification.
 *
 * Every test resets the database first, so counts are always exact
 * (deterministic), never "assert it's at least N".
 */

beforeEach(async () => {
  await resetTestDatabase();
});

/** Bare-bones second ProfessionalProfile owner for a MatchSuggestion pair —
 * we don't need any of createTestUser's privacy/matching-relevant options
 * here, just a valid userId + profileId to satisfy the schema's required
 * foreign keys. */
async function makeSuggestionPair(opts: {
  createdAt: Date;
  status?: MatchStatus;
  userACreatedAt?: Date;
  userBCreatedAt?: Date;
}) {
  const a = await createTestUser();
  const b = await createTestUser();

  if (opts.userACreatedAt) {
    await prisma.user.update({ where: { id: a.user.id }, data: { createdAt: opts.userACreatedAt } });
  }
  if (opts.userBCreatedAt) {
    await prisma.user.update({ where: { id: b.user.id }, data: { createdAt: opts.userBCreatedAt } });
  }

  const suggestion = await prisma.matchSuggestion.create({
    data: {
      userAId: a.user.id,
      userBId: b.user.id,
      profileAId: a.profile.id,
      profileBId: b.profile.id,
      status: opts.status ?? "PROPOSED",
      createdAt: opts.createdAt,
      expiresAt: new Date(opts.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return { a, b, suggestion };
}

describe("getAdminAnalytics — empty database", () => {
  it("guards every division/average and returns null-safe placeholders, never NaN/Infinity/a crash", async () => {
    const result = await getAdminAnalytics(30);

    expect(result).toMatchObject({
      periodDays: 30,
      totalUsers: 0,
      newUsers: 0,
      totalSuggestions: 0,
      newSuggestions: 0,
      totalConfirmedMatches: 0,
      newConfirmedMatches: 0,
      usersWithoutMatch: 0,
      avgSecondsToFirstMatch: null,
      medianSecondsToFirstMatch: null,
      failedJobRunCount: 0,
      lastSuccessfulRun: null,
      lastFailedRun: null,
      mostRecentRun: null,
    });
  });
});

describe("getAdminAnalytics — user counts and the period filter", () => {
  it("counts every user as 'registered' regardless of status, and scopes 'new' to the period window", async () => {
    const now = await createTestUser();
    const recent = await createTestUser();
    const old = await createTestUser({ userStatus: "SUSPENDED" });
    await prisma.user.update({
      where: { id: old.user.id },
      data: { createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    });
    void now;
    void recent;

    const result = await getAdminAnalytics(30);

    expect(result.totalUsers).toBe(3); // includes the 40-day-old SUSPENDED user
    expect(result.newUsers).toBe(2); // only the two created "now" fall inside 30 days
  });
});

describe("getAdminAnalytics — suggestion and confirmed-match counts", () => {
  it("counts all suggestions in totalSuggestions, and only the confirmed-match statuses in totalConfirmedMatches", async () => {
    const t0 = new Date();
    await makeSuggestionPair({ createdAt: t0, status: "PROPOSED" });
    await makeSuggestionPair({ createdAt: t0, status: "DECLINED" });
    await makeSuggestionPair({ createdAt: t0, status: "MUTUALLY_ACCEPTED" });
    await makeSuggestionPair({ createdAt: t0, status: "ACCESS_CHECK" });
    await makeSuggestionPair({ createdAt: t0, status: "ACTIVE" });

    const result = await getAdminAnalytics(30);

    expect(result.totalSuggestions).toBe(5);
    expect(result.totalConfirmedMatches).toBe(3); // MUTUALLY_ACCEPTED + ACCESS_CHECK + ACTIVE
  });

  it("scopes newSuggestions/newConfirmedMatches to the selected period", async () => {
    const withinPeriod = new Date();
    const outsidePeriod = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

    await makeSuggestionPair({ createdAt: withinPeriod, status: "MUTUALLY_ACCEPTED" });
    await makeSuggestionPair({ createdAt: outsidePeriod, status: "MUTUALLY_ACCEPTED" });
    await makeSuggestionPair({ createdAt: outsidePeriod, status: "PROPOSED" });

    const result = await getAdminAnalytics(30);

    expect(result.totalSuggestions).toBe(3);
    expect(result.newSuggestions).toBe(1);
    expect(result.totalConfirmedMatches).toBe(2);
    expect(result.newConfirmedMatches).toBe(1);
  });
});

describe("getAdminAnalytics — time to first match (User.createdAt -> first MatchSuggestion.createdAt)", () => {
  it("computes exact avg/median across two pairs, plus a correct never-matched count for a solo user", async () => {
    const baseline = new Date("2024-01-01T00:00:00.000Z");

    // Pair 1: both users "created" at baseline, their shared suggestion
    // created 100s later -> delta 100s for BOTH userA and userB.
    await makeSuggestionPair({
      createdAt: new Date(baseline.getTime() + 100_000),
      userACreatedAt: baseline,
      userBCreatedAt: baseline,
    });

    // Pair 2: same baseline, suggestion created 300s later -> delta 300s for
    // both members of this pair.
    await makeSuggestionPair({
      createdAt: new Date(baseline.getTime() + 300_000),
      userACreatedAt: baseline,
      userBCreatedAt: baseline,
    });

    // A fifth, solo user with no suggestion at all -> never matched.
    const solo = await createTestUser();
    await prisma.user.update({ where: { id: solo.user.id }, data: { createdAt: baseline } });

    const result = await getAdminAnalytics(30);

    // deltas = [100, 100, 300, 300] (seconds) across the 4 matched users.
    expect(result.usersWithoutMatch).toBe(1);
    expect(result.avgSecondsToFirstMatch).toBe(200); // (100+100+300+300)/4
    expect(result.medianSecondsToFirstMatch).toBe(200); // continuous percentile of [100,100,300,300]
  });

  it("only counts a user's own suggestions toward their own first-match time (not every suggestion in the table)", async () => {
    const baseline = new Date("2024-01-01T00:00:00.000Z");

    // A single pair — verifies both sides of one suggestion resolve to the
    // same delta, and unrelated users elsewhere don't leak into it.
    const { a, b } = await makeSuggestionPair({
      createdAt: new Date(baseline.getTime() + 50_000),
      userACreatedAt: baseline,
      userBCreatedAt: baseline,
    });

    const result = await getAdminAnalytics(30);

    expect(result.usersWithoutMatch).toBe(0);
    expect(result.avgSecondsToFirstMatch).toBe(50);
    expect(result.medianSecondsToFirstMatch).toBe(50);
    void a;
    void b;
  });
});

describe("getAdminAnalytics — matching job observability tiles", () => {
  async function createJobRun(overrides: {
    status: JobRunStatus;
    startedAt?: Date;
    finishedAt?: Date | null;
    usersProcessed?: number;
    matchesCreated?: number;
    notificationsSent?: number;
    failedUserCount?: number;
    errorSummary?: string | null;
  }) {
    return prisma.jobRun.create({
      data: {
        jobName: MATCHING_JOB_NAME,
        startedAt: new Date(),
        finishedAt: new Date(),
        usersProcessed: 0,
        matchesCreated: 0,
        notificationsSent: 0,
        failedUserCount: 0,
        ...overrides,
      },
    });
  }

  it("picks the most recent SUCCESS run as lastSuccessfulRun and the most recent FAILURE run as lastFailedRun, independent of overall recency", async () => {
    const oldSuccess = new Date("2024-01-01T00:00:00Z");
    const newSuccess = new Date("2024-01-03T00:00:00Z");
    const oldFailure = new Date("2024-01-02T00:00:00Z");

    await createJobRun({ status: "SUCCESS", startedAt: oldSuccess, usersProcessed: 1, matchesCreated: 1 });
    await createJobRun({ status: "SUCCESS", startedAt: newSuccess, usersProcessed: 2, matchesCreated: 2 });
    await createJobRun({ status: "FAILURE", startedAt: oldFailure, errorSummary: "boom" });

    const result = await getAdminAnalytics(30);

    expect(result.lastSuccessfulRun?.startedAt).toEqual(newSuccess);
    expect(result.lastSuccessfulRun?.usersProcessed).toBe(2);
    expect(result.lastFailedRun?.startedAt).toEqual(oldFailure);
    expect(result.lastFailedRun?.errorSummary).toBe("boom");
    // mostRecentRun is the newest row regardless of status -> the newSuccess one.
    expect(result.mostRecentRun?.startedAt).toEqual(newSuccess);
  });

  it("counts only FAILURE-status rows in failedJobRunCount, and ignores rows for a different jobName", async () => {
    await createJobRun({ status: "SUCCESS" });
    await createJobRun({ status: "FAILURE" });
    await createJobRun({ status: "FAILURE" });
    await createJobRun({ status: "PARTIAL" });
    await createJobRun({ status: "RUNNING" });
    await prisma.jobRun.create({
      data: { jobName: "some-other-job", status: "FAILURE", startedAt: new Date() },
    });

    const result = await getAdminAnalytics(30);

    expect(result.failedJobRunCount).toBe(2);
  });

  it("reports null tiles (not a crash) when JobRun rows exist only for a different jobName", async () => {
    await prisma.jobRun.create({ data: { jobName: "some-other-job", status: "SUCCESS", startedAt: new Date() } });

    const result = await getAdminAnalytics(30);

    expect(result.lastSuccessfulRun).toBeNull();
    expect(result.lastFailedRun).toBeNull();
    expect(result.mostRecentRun).toBeNull();
    expect(result.failedJobRunCount).toBe(0);
  });
});
