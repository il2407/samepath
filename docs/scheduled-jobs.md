# Scheduled jobs

**Status: one job exists — the automatic matching job.** This document
covers how it's triggered (locally and in a real deployment), how it's
guarded against overlapping/duplicate runs, and its known limitations. It's
the first piece of scheduled-job infrastructure in this codebase —
`docs/architecture-decisions.md` #9 explains why nothing has run on a
schedule until now (every other "due date" concern is checked lazily,
inline, at the top of whatever read/write path cares about it). This job
couldn't follow that pattern: unlike an access pass quietly expiring the
next time someone looks at it, generating match suggestions for a user who
never opens the app again would simply never happen without something
external poking the system periodically.

## What it does

`src/modules/matching/job.ts#runMatchingJob` pages through every
`ProfessionalProfile` with `status: "ACTIVE"` and calls
`generateSuggestionsForUser` (`src/modules/matching/service.ts`) for each
one — the exact same function the in-app "Find matches" button calls
(`refreshSuggestionsAction` in `matching/actions.ts`). This file never
re-implements or forks any scoring/privacy/creation logic; it only adds the
scheduling-adjacent concerns: batching, run-level bookkeeping, overlap
prevention, per-user retry/failure isolation, and an email notification for
matches created while nobody was looking at the app.

Separately, every entry to the member app (a full load of the `/app`
layout) runs the same search for the signed-in user via
`searchNewSuggestionsOnVisit` in `matching/service.ts`: new suggestions get
an in-app `NEW_MATCH` notification for both sides plus a pop-up, and there's
an in-memory 60-second cooldown per user against rapid reloads. That covers
users who are active; this job covers the ones who aren't.

Every run is recorded as one `JobRun` row (`prisma/schema.prisma`):
`status` (`RUNNING` / `SUCCESS` / `PARTIAL` / `FAILURE`), `startedAt` /
`finishedAt`, `usersProcessed`, `matchesCreated`, `notificationsSent`,
`failedUserCount`, and a safe `errorSummary` (user IDs and short error
messages only — never profile or résumé content). This table has no
user-facing reader; it's an admin/diagnostic table only, same as
`PrivacyDecisionAudit` / `MatchScoreBreakdown` (decision #7) — a future
admin dashboard tile can read it directly.

## Correctness guarantees and how they're implemented

- **No duplicate suggestions.** `generateSuggestionsForUser`'s own
  existing-non-terminal-suggestion check is the primary de-dup mechanism —
  true whether it's called by this job, the manual button, or both, since
  neither caller can create a second row for a pair that already has one.
- **No overlapping runs.** Two scheduler triggers firing close together (or
  one firing while a previous run is still `RUNNING`) result in exactly one
  actual run. The "is one already `RUNNING`? then insert a new `RUNNING`
  row" check-and-act happens inside one Postgres transaction guarded by
  `pg_try_advisory_xact_lock` (see `job.ts#claimRun`) — a transaction-scoped
  advisory lock, released automatically on commit/rollback, so a crashed
  process can never leave it stuck. The second trigger's `claimRun()`
  returns `null` immediately; `runMatchingJob()` reports
  `status: "SKIPPED_ALREADY_RUNNING"` and the route responds `409`.
- **No indefinitely stuck runs.** A `RUNNING` row older than 30 minutes
  (`STALE_RUN_THRESHOLD_MS`) is treated as orphaned — its owning process
  almost certainly crashed before it could record a final status — and is
  reclaimed: marked `FAILURE` with an explanatory `errorSummary`, then a
  fresh run proceeds.
- **No duplicate notifications.** Before sending the "you have new
  matches" email, the job checks for a recent `NotificationLog` row of type
  `NEW_MATCH_SUGGESTIONS` for that user (same check-before-send convention
  as `access-passes/service.ts#sendExpiryRemindersDue`) and skips sending
  if one exists within the last hour. This is what makes a retried
  notification step, or a suggestion's two participants both being
  notified in the same run, safe against sending duplicate emails.
- **One user's failure doesn't abort the batch.** Each user's unit of work
  is wrapped independently; an error is retried up to 3 times with a short
  backoff, then recorded and skipped — the run continues with the next
  user. Because `generateSuggestionsForUser` is idempotent, a user left
  failing here is naturally retried by the next scheduled run with no
  special recovery code needed.
- **Batching, not all-pairs.** The eligible-user list is paged
  (`USER_BATCH_SIZE = 200` per page, cursor-based) and processed
  sequentially — never loaded or processed all at once. The O(n) work per
  user (scoring every other candidate) is `generateSuggestionsForUser`'s
  own responsibility, unchanged by this job.

See the extensive comments in `job.ts` for the full reasoning behind each
of these, including a documented, narrow residual race between this job
and the manual button for the *same user* processed at the *same instant*
(see "Known limitations" below).

## Triggering it locally

The route is protected by a shared secret, `JOB_SCHEDULER_SECRET`
(`.env.example`) — generate one the same way as `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put it in `.env` as `JOB_SCHEDULER_SECRET=...`, start the dev server, then
call the route with either supported header:

```bash
# Authorization: Bearer <secret>
curl -i -X POST http://localhost:3000/api/jobs/matching \
  -H "Authorization: Bearer $JOB_SCHEDULER_SECRET"

# or the plain custom header, for schedulers that can't easily set Authorization
curl -i -X POST http://localhost:3000/api/jobs/matching \
  -H "x-job-scheduler-secret: $JOB_SCHEDULER_SECRET"
```

`GET` works identically to `POST` (see the route's comment for why both are
supported). A successful/partial run responds `200` with the `JobRunSummary`
JSON body; an already-in-progress run responds `409`; a fully failed run or
a wrong/missing secret responds `500` / `401` respectively.

With no migration applied yet for the `JobRun` table (see the note in this
workstream's final report), calling this locally before that migration
lands will fail with a Postgres "relation does not exist" error the moment
`job.ts` touches the `JobRun` table — expected, not a bug in the route or
job logic.

## Triggering it in production

**Nothing in this codebase runs the job on a timer.** Per this codebase's
existing "interface + documented real-world adapter, fake/local impl only"
pattern (see `Mailer` / `Storage` / `PaymentProvider` in `README.md`'s
Adapters table), the "adapter" for scheduling here is simply *an operator
configures an external HTTP-calling scheduler* — no cron/queue process is
built, run, or assumed by the application itself. Any of the following
work identically, since the route is a plain authenticated HTTP endpoint.

**On Vercel (the chosen host)**, `vercel.json` registers a Vercel Cron
that `GET`s `/api/jobs/matching` daily at 05:00 UTC. Vercel sends
`Authorization: Bearer $CRON_SECRET`, so set the `CRON_SECRET` project
env var to the *same value* as `JOB_SCHEDULER_SECRET`. The daily schedule
fits the Hobby plan; on Pro you can tighten it (e.g. `0 * * * *`). Other
options:

- A managed cron-as-a-service product (e.g. cron-job.org, EasyCron,
  Upstash QStash, GitHub Actions on a `schedule:` trigger, your hosting
  platform's own cron feature if it has one) configured to `POST` (or
  `GET`) `https://<your-domain>/api/jobs/matching` with the
  `Authorization: Bearer <JOB_SCHEDULER_SECRET>` header, on whatever
  interval matches the product's freshness needs (e.g. hourly).
- A step in a deploy/ops pipeline (a scheduled GitHub Actions workflow, a
  Kubernetes `CronJob` hitting the service over its internal network, a
  crontab entry on the host running `curl` with the header above) — the
  same call as the local example, pointed at the production URL.

Recommended minimums before relying on this in production:

1. Treat `JOB_SCHEDULER_SECRET` like any other production secret — a real
   random value (never the local one), stored in whatever secret manager
   the deployment already uses, rotated if it's ever exposed in a log.
2. Pick an interval and just document it somewhere operational (this repo
   has no config for "how often" — that's entirely the external
   scheduler's job). Since suggestion generation is idempotent and cheap
   for a user already at their suggestion cap, running it more often than
   strictly necessary is safe, just wasteful.
3. Alert on a `409`/`500` pattern that persists across several scheduled
   triggers in a row (a single `409` is normal — it just means the
   previous run was still going — but a `409` that never resolves to a
   `200` suggests a stuck/crashed run past the 30-minute stale-reclaim
   window, worth a human look) and definitely on a `500`.
4. Once an admin dashboard reads `JobRun` directly (a natural next step,
   not built in this workstream), prefer that over parsing HTTP responses
   for day-to-day monitoring — the table has the full history, the HTTP
   response only has the latest call's outcome.

## Known limitations

- **A narrow, documented race between this job and the manual button for
  the same user.** This job's overlap guard only serializes against *other
  calls to this job* — it does nothing to serialize against
  `refreshSuggestionsAction` (the manual "Find matches" button), which
  calls `generateSuggestionsForUser` directly and must keep working
  unmodified. If a manual click and this job process the *same user* at
  the *same instant*, they share `generateSuggestionsForUser`'s own
  existing-suggestion check as their only de-dup mechanism (true today,
  independent of this job existing). This is a real but very narrow
  window. Fully closing it would need a change inside
  `generateSuggestionsForUser` itself (e.g. a per-subject advisory lock, or
  a DB constraint on non-terminal `(userAId, userBId)` pairs) — out of this
  workstream's scope, since `matching/service.ts` is read-only here. See
  this workstream's final report for the corresponding integration
  request.
- **The "notify the other side of a new suggestion too" logic is a
  best-effort inference, not something `service.ts` hands back directly.**
  `generateSuggestionsForUser` returns only a count of suggestions created,
  not their IDs, so `job.ts#notifyForNewlyCreatedSuggestions` infers which
  rows were just created by taking the N most-recently-created rows with
  `userAId` equal to the processed user (always true for a fresh row — see
  `matching/service.ts`). If some other process inserts a same-shaped row
  at the exact same instant, the wrong candidate could be notified instead
  of the right one — a notification-accuracy issue only, never a duplicate-
  or lost-suggestion issue. Returning created suggestion IDs from
  `generateSuggestionsForUser` would remove this inference entirely (same
  integration request as above).
- **No configurable schedule/backoff inside the app.** By design (see
  "Triggering it in production" above) — this keeps the app free of a
  second process to operate, matching decision #9's stated MVP tradeoff.
