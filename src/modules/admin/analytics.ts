import "server-only";
import { prisma } from "@/shared/db";
import { MATCHING_JOB_NAME } from "@/modules/matching/job";
import type { JobRun } from "@/generated/prisma/client";
import {
  ANALYTICS_PERIODS,
  DEFAULT_ANALYTICS_PERIOD_DAYS,
  parseAnalyticsPeriod,
  type AnalyticsPeriodDays,
} from "@/modules/admin/analytics-period";

// Re-exported so callers (the page component) can import everything
// period-related from this one module; the split from analytics-period.ts
// exists purely so that file's tests avoid pulling in @/shared/db.
export { ANALYTICS_PERIODS, DEFAULT_ANALYTICS_PERIOD_DAYS, parseAnalyticsPeriod };
export type { AnalyticsPeriodDays };

/**
 * Admin analytics dashboard (backlog item 15, WS8). Read-only aggregate
 * reporting — no per-user drill-down, no raw user lists, no identifying
 * fields. Every count/rate here is either a plain Prisma count/groupBy or a
 * single Postgres aggregate query; nothing iterates per-user in JS (see
 * getTimeToFirstMatchStats below for the one calculation that would
 * otherwise need a per-user join).
 */

/**
 * "Confirmed match" statuses — the same categorization
 * `getMarketplaceHealthMetrics` (metrics.ts) uses for its
 * `mutualAcceptanceRate`. Duplicated here as a literal rather than imported,
 * since metrics.ts doesn't export it and this workstream avoids touching
 * that file beyond its own additions (see final report's integration
 * requests — exporting this list from metrics.ts would remove the
 * duplication).
 *
 * "Total matches" is ambiguous on its own: it could mean every
 * MatchSuggestion row ever generated (the broadest signal of matching-engine
 * activity, including proposals nobody has acted on yet) or only pairs that
 * both sides actually reciprocated (mutually accepted or beyond). Rather
 * than pick one reading and hide the other, this dashboard shows both,
 * labeled distinctly: "suggestions" (all rows) and "confirmed matches"
 * (this list).
 */
const CONFIRMED_MATCH_STATUSES = ["MUTUALLY_ACCEPTED", "ACCESS_CHECK", "ACTIVE"] as const;

interface TimeToFirstMatchRow {
  total_users: number;
  users_with_match: number;
  avg_seconds: number | null;
  median_seconds: number | null;
}

export interface TimeToFirstMatchStats {
  /** Users with at least one MatchSuggestion (as either side). */
  usersWithMatch: number;
  /** Users with zero MatchSuggestion rows — "never received a match". */
  usersWithoutMatch: number;
  /** Average seconds between User.createdAt and their first
   * MatchSuggestion.createdAt, across users who have at least one — null
   * when nobody has a suggestion yet (guarded, never NaN/Infinity). */
  avgSecondsToFirstMatch: number | null;
  /** Median (50th percentile) of the same distribution. */
  medianSecondsToFirstMatch: number | null;
}

/**
 * "Time to first match" per the backlog's explicit MVP proxy definition:
 * User.createdAt -> the earliest MatchSuggestion.createdAt where that user
 * is either userAId or userBId. This is a known-coarse proxy (a later
 * profile edit or resume upload doesn't move User.createdAt, and this
 * doesn't distinguish "actually usable profile" from "just registered") —
 * accepted per the backlog, not something this workstream invents a
 * replacement for (e.g. no new `activatedAt` column/migration).
 *
 * Computed as a single Postgres query rather than loading every user and
 * every suggestion into JS and joining them there: a per-user LEFT JOIN +
 * MIN() to find each user's first suggestion timestamp, then AVG/
 * PERCENTILE_CONT over that per-user distribution. This is one sequential
 * scan + hash join over `users` and `match_suggestions`, not an N+1 loop —
 * satisfies backlog item 7 ("use a groupBy/aggregate query rather than
 * iterating in JS wherever Prisma can do it directly"). Prisma's query
 * builder can't express "first row per group via correlated MIN, then an
 * aggregate over the per-group result" in one call, hence the raw SQL.
 *
 * At current dev-database scale this comfortably runs in milliseconds; if a
 * future, much larger `users`/`match_suggestions` table makes this slow, the
 * fix would be a composite index (e.g. on `match_suggestions("userAId")` /
 * `("userBId")` covering `createdAt`) — deliberately NOT added here per
 * backlog item 8 (no speculative index additions; that needs coordinator
 * sign-off + the repo's migration protocol).
 */
async function getTimeToFirstMatchStats(): Promise<TimeToFirstMatchStats> {
  const rows = await prisma.$queryRaw<TimeToFirstMatchRow[]>`
    WITH first_suggestion AS (
      SELECT
        u.id AS user_id,
        u."createdAt" AS user_created_at,
        MIN(ms."createdAt") AS first_match_at
      FROM "users" u
      LEFT JOIN "match_suggestions" ms
        ON ms."userAId" = u.id OR ms."userBId" = u.id
      GROUP BY u.id, u."createdAt"
    ),
    with_match AS (
      SELECT EXTRACT(EPOCH FROM (first_match_at - user_created_at)) AS seconds_to_match
      FROM first_suggestion
      WHERE first_match_at IS NOT NULL
    )
    SELECT
      (SELECT COUNT(*)::int FROM first_suggestion) AS total_users,
      (SELECT COUNT(*)::int FROM with_match) AS users_with_match,
      (SELECT AVG(seconds_to_match)::float8 FROM with_match) AS avg_seconds,
      (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY seconds_to_match)::float8 FROM with_match) AS median_seconds
  `;

  const row = rows[0];
  const totalUsers = row?.total_users ?? 0;
  const usersWithMatch = row?.users_with_match ?? 0;

  return {
    usersWithMatch,
    usersWithoutMatch: totalUsers - usersWithMatch,
    avgSecondsToFirstMatch: row?.avg_seconds ?? null,
    medianSecondsToFirstMatch: row?.median_seconds ?? null,
  };
}

export interface JobRunTile {
  id: string;
  status: JobRun["status"];
  startedAt: Date;
  finishedAt: Date | null;
  usersProcessed: number;
  matchesCreated: number;
  notificationsSent: number;
  failedUserCount: number;
  errorSummary: string | null;
}

function toJobRunTile(run: JobRun | null): JobRunTile | null {
  if (!run) return null;
  return {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    usersProcessed: run.usersProcessed,
    matchesCreated: run.matchesCreated,
    notificationsSent: run.notificationsSent,
    failedUserCount: run.failedUserCount,
    errorSummary: run.errorSummary,
  };
}

export interface AdminAnalytics {
  periodDays: AnalyticsPeriodDays;

  /** All User rows regardless of status (ACTIVE/PAUSED/SUSPENDED/DELETED) —
   * "registered" means an account was ever created, distinct from
   * getMarketplaceHealthMetrics's ACTIVE-only "totalUsers". Note this means
   * a soft-deleted (PII-scrubbed) account still counts here, same as it
   * still counts as "existed" for any historical reporting purpose. */
  totalUsers: number;
  newUsers: number;

  totalSuggestions: number;
  newSuggestions: number;
  totalConfirmedMatches: number;
  newConfirmedMatches: number;

  usersWithoutMatch: number;
  avgSecondsToFirstMatch: number | null;
  medianSecondsToFirstMatch: number | null;

  /** All-time count of FAILURE-status JobRun rows for the matching job. */
  failedJobRunCount: number;
  lastSuccessfulRun: JobRunTile | null;
  lastFailedRun: JobRunTile | null;
  /** Most recent JobRun row regardless of status — the "most recent relevant
   * JobRun row" the backlog asks for, for usersProcessed/matchesCreated/
   * notificationsSent even if that latest run happened to fail or is still
   * RUNNING. */
  mostRecentRun: JobRunTile | null;
}

/**
 * Aggregate analytics for the admin dashboard (backlog item 15). Every
 * count is a plain Prisma count/groupBy except getTimeToFirstMatchStats
 * (a single raw aggregate query, see its own comment) — no per-user
 * iteration anywhere in this function. `periodDays` only scopes the
 * "new X in period" counts; totals, time-to-first-match, and job-run tiles
 * are always all-time (a period filter on "last successful run" or
 * "average time to match" would silently hide the most relevant answer
 * whenever nothing happened to fall inside the window).
 */
export async function getAdminAnalytics(
  periodDays: AnalyticsPeriodDays = DEFAULT_ANALYTICS_PERIOD_DAYS,
): Promise<AdminAnalytics> {
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsers,
    totalSuggestions,
    newSuggestions,
    totalConfirmedMatches,
    newConfirmedMatches,
    timeToFirstMatch,
    failedJobRunCount,
    lastSuccessfulRun,
    lastFailedRun,
    mostRecentRun,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.matchSuggestion.count(),
    prisma.matchSuggestion.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.matchSuggestion.count({ where: { status: { in: [...CONFIRMED_MATCH_STATUSES] } } }),
    prisma.matchSuggestion.count({
      where: { status: { in: [...CONFIRMED_MATCH_STATUSES] }, createdAt: { gte: periodStart } },
    }),
    getTimeToFirstMatchStats(),
    prisma.jobRun.count({ where: { jobName: MATCHING_JOB_NAME, status: "FAILURE" } }),
    prisma.jobRun.findFirst({
      where: { jobName: MATCHING_JOB_NAME, status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
    }),
    prisma.jobRun.findFirst({
      where: { jobName: MATCHING_JOB_NAME, status: "FAILURE" },
      orderBy: { startedAt: "desc" },
    }),
    prisma.jobRun.findFirst({
      where: { jobName: MATCHING_JOB_NAME },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return {
    periodDays,
    totalUsers,
    newUsers,
    totalSuggestions,
    newSuggestions,
    totalConfirmedMatches,
    newConfirmedMatches,
    usersWithoutMatch: timeToFirstMatch.usersWithoutMatch,
    avgSecondsToFirstMatch: timeToFirstMatch.avgSecondsToFirstMatch,
    medianSecondsToFirstMatch: timeToFirstMatch.medianSecondsToFirstMatch,
    failedJobRunCount,
    lastSuccessfulRun: toJobRunTile(lastSuccessfulRun),
    lastFailedRun: toJobRunTile(lastFailedRun),
    mostRecentRun: toJobRunTile(mostRecentRun),
  };
}
