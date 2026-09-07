import "server-only";
import { prisma } from "@/shared/db";
import { getMailer } from "@/modules/notifications/mailer";
import { generateSuggestionsForUser } from "@/modules/matching/service";
import type { JobRun, JobRunStatus } from "@/generated/prisma/client";

/**
 * The first piece of scheduled-job infrastructure in this codebase — see
 * docs/architecture-decisions.md #9 (why nothing runs on a scheduler today)
 * and docs/scheduled-jobs.md (how to actually trigger this one, locally and
 * in production).
 *
 * This file is intentionally placed under src/modules/matching/ rather than
 * a new top-level src/jobs/ directory: it's a single job specific to one
 * domain, and every other domain in this app already keeps its own
 * lazily-run "due date" logic inside its own module (see
 * access-passes/service.ts#sendExpiryRemindersDue,
 * interviews/service.ts#publishDueExperiences) rather than a shared
 * scheduler concept. If a second scheduled job is ever added, pulling the
 * generic "claim a JobRun row under an advisory lock, retry per unit of
 * work, record safe failure detail" scaffolding below out into a shared
 * src/shared/job-runner.ts would be the right move then — premature to do
 * for one job now.
 *
 * Ownership boundary: this file NEVER re-implements matching/scoring/privacy
 * logic. `generateSuggestionsForUser` (matching/service.ts, read-only from
 * this workstream) is the single shared unit of work — the exact same
 * function the manual "Find matches" button calls
 * (matching/actions.ts#refreshSuggestionsAction). This file only adds: batch
 * iteration over eligible users, run-level bookkeeping (JobRun), overlap
 * prevention, per-user retry/failure isolation, and a notification email for
 * matches created while the user wasn't around to see the in-app result.
 */

export const MATCHING_JOB_NAME = "matching-suggestions" as const;

/** How many ProfessionalProfile rows to load per page while paginating the
 * eligible-user list — keeps a single run from ever loading the entire
 * table into memory at once, however large the user base grows. */
const USER_BATCH_SIZE = 200;

/** Bounded retry for a single step of a single user's unit of work. Covers
 * transient failures (a dropped connection, a momentary DB blip) — NOT a
 * substitute for the next scheduled run, which naturally retries any user
 * whose *suggestion generation* still fails after this, for free, because
 * generateSuggestionsForUser is idempotent. */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;

/** A RUNNING JobRun older than this is treated as orphaned (its process
 * almost certainly crashed before reaching the status update) rather than
 * genuinely in progress, and is reclaimed so the job name doesn't stay
 * permanently locked out. Comfortably above how long a full batch over this
 * app's expected user counts should ever take. */
const STALE_RUN_THRESHOLD_MS = 30 * 60 * 1000;

/** NotificationLog "type" for the automated "you have new matches" email —
 * distinct from anything the manual button path sends (it sends nothing;
 * the user is already looking at the result in the UI). */
const NEW_MATCHES_NOTIFICATION_TYPE = "NEW_MATCH_SUGGESTIONS";

/** Dedup window for that email, mirroring the NotificationLog
 * check-before-send convention in access-passes/service.ts's
 * sendExpiryRemindersDue. This is what makes a retried step, or two people
 * on the same freshly-created suggestion both getting processed, safe
 * against sending duplicate emails — it is not the mechanism that prevents
 * duplicate *suggestions*, which is generateSuggestionsForUser's own
 * existing-suggestion check. */
const NOTIFICATION_DEDUP_WINDOW_MS = 60 * 60 * 1000;

export interface JobRunSummary {
  /** null only when the run never started because another one already owns
   * this job name — see runMatchingJob's SKIPPED_ALREADY_RUNNING case. */
  jobRunId: string | null;
  status: JobRunStatus | "SKIPPED_ALREADY_RUNNING";
  usersProcessed: number;
  matchesCreated: number;
  notificationsSent: number;
  failedUserCount: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Never logs raw error objects or profile/résumé content — user IDs are
 * cuids (opaque, not PII) and error messages from this codebase's own
 * Prisma/mailer calls don't carry user-entered content, but this still
 * truncates defensively. */
function sanitizeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 500);
  return "unknown error";
}

/** Generic bounded retry with exponential backoff, applied independently to
 * each step of a user's unit of work (see processUserWithRetry) rather than
 * to the whole combined block — see that function's comment for why. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}

type FailureRecord = { userId: string; error: string };

function summarizeFailures(failures: FailureRecord[], notifyFailures: FailureRecord[]): string | null {
  if (failures.length === 0 && notifyFailures.length === 0) return null;
  const parts = [
    ...failures.slice(0, 20).map((f) => `${f.userId}: ${f.error}`),
    ...notifyFailures.slice(0, 10).map((f) => `notify:${f.userId}: ${f.error}`),
  ];
  return parts.join(" | ").slice(0, 4000);
}

/**
 * Claims the right to run this job right now, or returns null if another
 * run already owns it. The "is one already RUNNING, then insert a new
 * RUNNING row" check-and-act happens inside a single Postgres transaction
 * guarded by `pg_try_advisory_xact_lock` (a transaction-scoped advisory
 * lock, auto-released on commit/rollback — never left stuck by a crash).
 * Without that lock, two schedulers firing at the same instant could both
 * observe "no RUNNING row exists yet" before either one's insert commits —
 * a classic TOCTOU race — and both proceed. The lock serializes exactly
 * that narrow window; it is not held for the run's full duration (the
 * RUNNING row inserted inside it is what represents ownership afterward).
 *
 * A RUNNING row older than STALE_RUN_THRESHOLD_MS is treated as orphaned
 * (its owning process almost certainly crashed) and reclaimed: marked
 * FAILURE with an explanatory errorSummary, then a fresh run proceeds.
 */
async function claimRun(): Promise<JobRun | null> {
  return prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(hashtext(${MATCHING_JOB_NAME})) AS locked
    `;
    if (!lockRows[0]?.locked) return null;

    const existingRunning = await tx.jobRun.findFirst({
      where: { jobName: MATCHING_JOB_NAME, status: "RUNNING" },
      orderBy: { startedAt: "desc" },
    });

    if (existingRunning) {
      const age = Date.now() - existingRunning.startedAt.getTime();
      if (age < STALE_RUN_THRESHOLD_MS) {
        return null; // a genuinely in-progress run owns this job name
      }
      await tx.jobRun.update({
        where: { id: existingRunning.id },
        data: {
          status: "FAILURE",
          finishedAt: new Date(),
          errorSummary: `reclaimed as stale: still RUNNING after ${Math.round(age / 1000)}s (threshold ${STALE_RUN_THRESHOLD_MS / 1000}s) — its process likely crashed`,
        },
      });
    }

    return tx.jobRun.create({ data: { jobName: MATCHING_JOB_NAME, status: "RUNNING" } });
  });
}

/**
 * Sends the "you have new matches" email to one user, but only if they
 * haven't already gotten one within the dedup window — the exact
 * NotificationLog check-before-send pattern used by
 * access-passes/service.ts#sendExpiryRemindersDue. Returns whether it
 * actually sent (vs. skipped as a recent duplicate).
 */
async function notifyNewSuggestions(userId: string, newCount: number): Promise<boolean> {
  const recent = await prisma.notificationLog.findFirst({
    where: {
      userId,
      type: NEW_MATCHES_NOTIFICATION_TYPE,
      sentAt: { gte: new Date(Date.now() - NOTIFICATION_DEDUP_WINDOW_MS) },
    },
  });
  if (recent) return false;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return false; // deleted between processing and notifying

  await getMailer().send({
    to: user.email,
    subject: "יש לך התאמות חדשות ב-SamePath",
    text: `נמצאו ${newCount} התאמות חדשות עבורך. היכנס/י לאפליקציה כדי לצפות בהן.`,
    html: `<div dir="rtl"><p>נמצאו ${newCount} התאמות חדשות עבורך.</p><p>היכנס/י לאפליקציה כדי לצפות בהן.</p></div>`,
  });
  await prisma.notificationLog.create({
    data: { userId, type: NEW_MATCHES_NOTIFICATION_TYPE, payload: { newCount } },
  });
  return true;
}

/**
 * Notifies everyone affected by the `createdCount` suggestions
 * generateSuggestionsForUser(subjectUserId) just created — not only the
 * subject. generateSuggestionsForUser always inserts new rows with userAId
 * set to whichever user it was called for (see matching/service.ts), so the
 * `createdCount` most-recently-created rows with userAId = subjectUserId
 * are exactly the ones from this call; each row's userBId is a candidate
 * who also now has a new pending suggestion but whose own turn in this run
 * (if any) will correctly see it as already-existing, not newly created, so
 * without this they would never get an email for it.
 *
 * This is a best-effort inference, not something service.ts hands back
 * directly (its return value is a plain count) — see this workstream's
 * final report for the corresponding integration request (returning the
 * created suggestion ids would remove the inference entirely). The
 * narrow failure mode if some other process inserts a userAId=subjectUserId
 * row at the exact same instant is misattributing which row is "new" for
 * notification purposes only; it never affects which suggestions exist.
 */
async function notifyForNewlyCreatedSuggestions(
  subjectUserId: string,
  createdCount: number,
): Promise<number> {
  if (createdCount <= 0) return 0;

  const newSuggestions = await prisma.matchSuggestion.findMany({
    where: { userAId: subjectUserId },
    orderBy: { createdAt: "desc" },
    take: createdCount,
    select: { userBId: true },
  });

  let sent = 0;
  if (await notifyNewSuggestions(subjectUserId, createdCount)) sent += 1;
  for (const { userBId } of newSuggestions) {
    if (await notifyNewSuggestions(userBId, 1)) sent += 1;
  }
  return sent;
}

interface ProcessUserResult {
  created: number;
  notificationsSent: number;
  /** Set only if the notify step permanently failed after retries — kept
   * separate from a thrown error because the suggestion-creation half of
   * this user's work already committed successfully by that point; see
   * processUserWithRetry. */
  notifyError?: string;
}

/**
 * One user's unit of work. Each step is retried independently
 * (withRetry, MAX_ATTEMPTS each) rather than retrying the combined block as
 * one attempt — deliberately, to avoid a subtle idempotency trap: if
 * suggestion creation succeeds but the *notification* step then fails,
 * retrying the whole block from scratch would call
 * generateSuggestionsForUser again, which correctly returns 0 (nothing new
 * to create, it's idempotent) — silently losing the fact that
 * `createdCount` suggestions from the earlier successful attempt were never
 * notified about. Retrying only the notify step avoids that: the already-
 * known `created` count survives regardless of how many times the notify
 * step itself is retried.
 *
 * A notify failure that survives all retries does NOT throw out of this
 * function — the suggestions themselves are safely persisted and fully
 * counted; only the email didn't go out. It's surfaced via `notifyError`
 * instead so the caller can record it for observability without treating
 * this user as a failed run participant (see runMatchingJob's status
 * calculation, which only degrades on suggestion-generation failures).
 */
async function processUserWithRetry(userId: string): Promise<ProcessUserResult> {
  const created = await withRetry(() => generateSuggestionsForUser(userId));

  try {
    const notificationsSent = await withRetry(() => notifyForNewlyCreatedSuggestions(userId, created));
    return { created, notificationsSent };
  } catch (notifyErr) {
    return { created, notificationsSent: 0, notifyError: sanitizeError(notifyErr) };
  }
}

/**
 * Runs the automatic matching job once: claims exclusive ownership of the
 * "matching-suggestions" JobRun name (see claimRun), then pages through
 * every ACTIVE ProfessionalProfile and calls generateSuggestionsForUser for
 * each, in USER_BATCH_SIZE-sized cursor pages, sequentially — not an
 * unbounded all-at-once pass, and no concurrency beyond one user at a time,
 * which keeps this job's own footprint predictable regardless of how many
 * eligible users exist (the per-user work inside generateSuggestionsForUser
 * is the part that's O(n) in candidate count; iterating users efficiently
 * is this file's entire job).
 *
 * Failure isolation: one user's suggestion-generation error (after
 * exhausting MAX_ATTEMPTS retries) is caught, recorded, and skipped — it
 * never aborts the run for every other user. Because
 * generateSuggestionsForUser is idempotent, a user left failing here is
 * naturally retried by the next scheduled run with no special recovery code
 * needed. A notify-only failure (see processUserWithRetry) is recorded
 * separately and does not count toward failedUserCount.
 *
 * Known residual race (documented, not silently ignored — see this
 * workstream's final report for the corresponding integration request):
 * this job's overlap guard only serializes against *other calls to this
 * job*. It does nothing to serialize against the manual "Find matches"
 * button (refreshSuggestionsAction), which calls generateSuggestionsForUser
 * directly and is explicitly required to keep working unmodified. If a
 * manual click and this job process the same user at the exact same
 * instant, they share generateSuggestionsForUser's own existing-suggestion
 * check as their only de-dup mechanism (already true today, before this
 * job existed) — a real but narrow window, since it requires the same user
 * to be the *subject* of both calls within milliseconds of each other.
 * Fully closing it would need a change inside generateSuggestionsForUser
 * itself (e.g. a per-subject advisory lock, or a DB constraint on
 * non-terminal (userAId,userBId) pairs), which is out of this workstream's
 * scope (matching/service.ts is read-only here).
 */
export async function runMatchingJob(): Promise<JobRunSummary> {
  const run = await claimRun();
  if (!run) {
    return {
      jobRunId: null,
      status: "SKIPPED_ALREADY_RUNNING",
      usersProcessed: 0,
      matchesCreated: 0,
      notificationsSent: 0,
      failedUserCount: 0,
    };
  }

  let usersProcessed = 0;
  let matchesCreated = 0;
  let notificationsSent = 0;
  const failures: FailureRecord[] = [];
  const notifyFailures: FailureRecord[] = [];

  try {
    let cursor: string | undefined;
    for (;;) {
      const batch: { userId: string }[] = await prisma.professionalProfile.findMany({
        where: { status: "ACTIVE" },
        select: { userId: true },
        orderBy: { userId: "asc" },
        take: USER_BATCH_SIZE,
        ...(cursor ? { cursor: { userId: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      for (const { userId } of batch) {
        usersProcessed += 1;
        try {
          const result = await processUserWithRetry(userId);
          matchesCreated += result.created;
          notificationsSent += result.notificationsSent;
          if (result.notifyError) notifyFailures.push({ userId, error: result.notifyError });
        } catch (err) {
          failures.push({ userId, error: sanitizeError(err) });
        }
      }

      cursor = batch[batch.length - 1]?.userId;
      if (batch.length < USER_BATCH_SIZE) break;
    }

    const status: JobRunStatus =
      failures.length === 0 && notifyFailures.length === 0
        ? "SUCCESS"
        : failures.length > 0 && failures.length >= usersProcessed
          ? "FAILURE"
          : "PARTIAL";

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        usersProcessed,
        matchesCreated,
        notificationsSent,
        failedUserCount: failures.length,
        errorSummary: summarizeFailures(failures, notifyFailures),
      },
    });

    return { jobRunId: run.id, status, usersProcessed, matchesCreated, notificationsSent, failedUserCount: failures.length };
  } catch (fatal) {
    // Something failed outside the per-user try/catch above (e.g. the batch
    // listing query itself, or the final status update). Best-effort record
    // what got through before re-throwing, rather than leaving the row
    // RUNNING forever — this is exactly the case STALE_RUN_THRESHOLD_MS
    // exists to eventually recover from even if this update also fails.
    await prisma.jobRun
      .update({
        where: { id: run.id },
        data: {
          status: "FAILURE",
          finishedAt: new Date(),
          usersProcessed,
          matchesCreated,
          notificationsSent,
          failedUserCount: failures.length,
          errorSummary: `fatal: ${sanitizeError(fatal)}`,
        },
      })
      .catch(() => {});
    throw fatal;
  }
}
