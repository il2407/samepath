# Security hardening pass (spec §16)

This is a status snapshot, not a certification. Each item below reflects
something actually checked in this codebase — a grep, a test run, a real
`pnpm audit` — not an assumed best practice. Items marked **gap** are real
and should be closed before any real deployment; nothing here was written
to make the list look complete.

## CSRF

Next.js App Router Server Actions carry built-in CSRF protection: the
framework compares the request's `Origin` header against the deployment's
allowed origins and rejects the call before it reaches application code.
Every mutation in this app goes through a Server Action (`"use server"`)
rather than a hand-rolled API route with a bearer/cookie auth model, so this
protection applies uniformly. `src/api/account/export` and
`src/api/auth/verify` are the two plain Route Handlers in the app;
`verify` only reads a token from the URL (no state-changing side effect
beyond what the token itself authorizes) and `export` requires an
authenticated session cookie, so neither depends on cross-origin form
submission the way a session-cookie-only endpoint would.

## Rate limiting

`src/shared/rate-limit.ts` is a fixed-window limiter with two adapters:
`memory` (per-process, dev/test) and `postgres` (one atomic upsert per
check against the shared `rate_limit_buckets` table). Production on Vercel
must use `RATE_LIMIT_ADAPTER=postgres`, since serverless instances don't
share memory.

Coverage as of this pass:

- Verification code requests — per-email and per-IP (`auth/service.ts`)
- Interview-experience validation/report actions (`interviews/validation.ts`)
- Contribution submission — 5/day per user (`interviews/actions.ts`)
- Resume upload — 10/hour per user (`resumes/actions.ts`), added in this
  pass since it runs real PDF/DOCX parsing and can create company rows,
  making it a real cost/spam vector otherwise.
- Connection messages — 60 per 10 minutes per user
- Meeting proposals — 30/hour per user
- Group join requests — 20/hour; user-created groups — 5/day
- Reports (connections and groups, shared bucket) — 10/day per user
- Access-pass purchase attempts — 10/hour per user (on top of the
  payment idempotency key)

## Malware scanning for uploads

`src/modules/resumes/malware-scan.ts` defines a `MalwareScanner` interface
and the `ResumeUpload.status` flow (`UPLOADED -> SCANNING -> READY /
REJECTED`). The default implementation (`MALWARE_SCANNER=heuristic`) runs
`src/modules/resumes/file-inspection.ts` in-process on every résumé and
profile-photo upload:

- **Format allow-list by magic bytes** — only PDF, ZIP-based DOCX, JPEG,
  PNG and WebP pass; anything else (executables, HTML, polyglots with a
  fake extension) is rejected.
- **PDF** — FlateDecode streams (including compressed object streams) are
  inflated and checked, `#xx` name escapes are decoded, and literal strings
  are stripped first so page text like "React/JS" can't false-positive.
  Rejects `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile(s)`,
  `/RichMedia`, `/XFA`, `/SubmitForm`, `/ImportData`, `/GoToE`. An
  encrypted PDF is accepted only when it has no object streams (encryption
  never covers plain dictionaries, so everything is still visible).
- **DOCX** — requires `[Content_Types].xml` + `word/document.xml`; rejects
  macros (`vbaProject.bin`, macro-enabled content types), ActiveX,
  embedded OLE objects, and external `attachedTemplate` / `oleObject` /
  `subDocument` / `frame` relationships (remote template injection).
  Ordinary external hyperlinks are fine.
- **Decompression bombs** — total inflated output is capped at 50MB.

**Honest limits:** this is structural, not signature-based antivirus — it
blocks the document features that carry executable payloads, not specific
known-bad files, and it doesn't validate image pixel data (photos are
magic-byte checked and served with `nosniff`, never executed). The only
reader of uploaded résumés is our own server-side text extraction, which
never executes document content. If a signature-based layer is wanted
later, add a cloud AV API as another `MalwareScanner` behind the same
interface (ClamAV needs a long-running daemon, which Vercel can't host).
`MALWARE_SCANNER=noop` accepts everything — local debugging only.

## Structured logging & redaction

All server-side logging goes through `src/shared/logger.ts`: one JSON
object per line (`level`, `time`, `msg`, plus context), which is what
Vercel's runtime logs and log drains index. Redaction is built in, not
opt-in — every context object passes through `redact()` before it's
serialized:

- values under keys that look like personal data or secrets (`email`,
  `password`, `token`, `secret`, `session`, `cookie`, `phone`, `name`,
  `address`, `code`, …) become `[redacted]`, at any depth;
- email addresses and `Bearer …` tokens are scrubbed from *any* string,
  including error messages and stacks (a mail provider's "550 mailbox
  x@y unavailable" doesn't leak the address);
- `Error`s are serialized to `name` / `message` / `stack` / `code` /
  `cause`.

Callers log opaque IDs (`userId`, `uploadId`, …) rather than personal
fields. Résumé filenames and text are never logged.

**Unhandled errors.** `src/instrumentation.ts#onRequestError` logs every
uncaught server error (Server Components, route handlers, Server Actions)
with method, path — query string dropped, since it can carry magic-link
tokens or an OAuth `code` — route, and the error `digest`. The root error
boundaries (`src/app/error.tsx`, `src/app/global-error.tsx`) show the user
a generic Hebrew message plus that digest as a support reference code, so
a report can be matched to its log line. Upload-scan rejections are logged
at `warn` with the scanner's reason.

**Uptime.** `GET /api/health` returns `200 {"status":"ok"}` when Postgres
is reachable and `503` otherwise, revealing nothing else. Point an uptime
monitor (Vercel's own, Better Stack, UptimeRobot, …) at it.

**Not included, by design:** an error-tracking SaaS (Sentry etc.) needs an
account and DSN that belong to the operator; Vercel's built-in logs have
short retention on Hobby, so for anything longer configure a log drain.
Adding Sentry later means calling its capture function from
`onRequestError` — the one choke point already exists.

**Still true:** `MAIL_ADAPTER=console` (the local default) prints the full
verification email — recipient and 6-digit code — to stdout.
`MAIL_ADAPTER=smtp` is **not optional** in any deployed environment.

## Safe error messages

Every Server Action in the app returns a typed `{ ok: boolean; error?:
string }` with a fixed, Hebrew, user-safe message — grepped across every
module's `actions.ts`/`*-actions.ts` file for this pass. The one place a
raw exception message is captured (`ResumeExtractionJob.error` in
`resumes/service.ts`) is a DB column read only by internal code; no route
or component ever renders it to a user (the client only ever sees the
boolean `extractionFailed`). Next.js itself also strips stack traces from
uncaught server errors returned to the client in production builds
(`NODE_ENV=production`), independent of anything in this app's code.

## Database constraints

Reviewed organically throughout development rather than as a single pass
at the end: idempotency keys are unique constraints, not just
convention (`Payment.idempotencyKey`, `CreditLedgerEntry` — see
`docs/architecture-decisions.md`), singleton per-user rows use `@unique`
on the foreign key (`ProfessionalProfile.userId`,
`PrivacyPreference.profileId`, etc.), and every user-owned child table
uses `onDelete: Cascade` back to `User` so `account.deleteAccount` can't
leave orphaned rows. The 252-test suite exercises these constraints
directly (e.g. the idempotency regression test in `credits/__tests__` that
was added specifically because a bare `catch {}` was once silently
swallowing a genuine FK violation — see `docs/architecture-decisions.md`
for that history).

## Dependency audit

Ran `pnpm audit` for this pass (2026-08-28): 4 findings, all transitive
through the `prisma` CLI package's own tooling
(`prisma > @prisma/studio-core > @visx/* > lodash`,
`prisma > @prisma/config > deepmerge-ts`) — `prisma studio`'s dev-only
dependency graph, not `@prisma/client`, the only Prisma package that ships
in the production server bundle. None of the 4 are reachable from
application runtime code. Re-run `pnpm audit` and upgrade `prisma` when a
patched release lands; no action is urgent today.

## Security headers

`next.config.ts` sets HSTS, `X-Content-Type-Options`, `X-Frame-Options:
DENY`, `Referrer-Policy`, a restrictive `Permissions-Policy`, and a CSP
limited to `frame-ancestors 'none'; object-src 'none'; base-uri 'self';
form-action 'self'`, and drops `X-Powered-By`. **Remaining gap:** no
`script-src` restriction — Next.js's inline bootstrap scripts need a
nonce-based CSP set from middleware, which is a separate change.

## File storage

`src/shared/storage.ts`'s `LocalStorage` adapter writes under
`.local-storage/` — outside `public/`, so nothing uploaded is ever served
by Next.js's static file handling. `S3Storage` (AWS S3 or any
S3-compatible store via `S3_ENDPOINT`) is the production adapter. The
bucket must block all public access: objects are only ever read
server-side and streamed through authenticated routes, never linked
directly, so no presigned URLs are issued.

## Summary

| Area | Status |
|---|---|
| CSRF | Covered by framework default |
| Rate limiting | Covered; Postgres adapter for multi-instance |
| Malware scanning | Structural in-process inspection (not signature AV) |
| Structured logging | JSON-line logger with built-in redaction, `onRequestError` hook, error boundaries, `/api/health`; console mailer must be off in prod |
| Safe error messages | Covered |
| DB constraints | Covered, test-verified |
| Dependency audit | Clean at runtime; 4 dev-tooling-only findings |
| Security headers | Baseline set; script CSP pending |
| File storage | Local adapter for dev; S3 adapter for production (private bucket) |
