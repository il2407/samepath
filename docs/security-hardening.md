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
REJECTED`) that a real scan step plugs into. The shipped implementation
(`NoopScanner`) always reports clean — it exists so the integration point
and status model are real and tested, not so uploads are actually screened.
**This must be replaced with a real scanner (ClamAV, a cloud AV/DLP API,
etc.) before accepting uploads from untrusted users.**

## Structured logging & redaction

There is no structured logging framework (pino/winston/etc.) in this MVP —
just a couple of `console.error` calls in `resumes/service.ts` for
best-effort file-cleanup failures, and both log only an opaque `uploadId`,
never PII. Grepped for every `console.*` call in `src/`; nothing else logs
outside the mailer.

**Real gap, not hypothetical:** `MAIL_ADAPTER` defaults to `console`
(`src/modules/notifications/mailer.ts`), which prints the full verification
email — including the recipient's address and the 6-digit code — to
stdout. That is required for local dev (there is no external mail account
to send through), but it means **`MAIL_ADAPTER=smtp` is not optional
before deployment** — leaving the console adapter on in any environment
with shared or persisted logs would leak login codes. Before production:
switch to the SMTP adapter and add a real structured logger with
request-ID correlation and PII redaction (email addresses, session
tokens, resume text) baked in from the start, not bolted on later.

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
| Malware scanning | Interface + status flow only, `NoopScanner` in place |
| Structured logging | Not implemented; console mailer is a real pre-prod risk |
| Safe error messages | Covered |
| DB constraints | Covered, test-verified |
| Dependency audit | Clean at runtime; 4 dev-tooling-only findings |
| Security headers | Baseline set; script CSP pending |
| File storage | Local adapter for dev; S3 adapter for production (private bucket) |
