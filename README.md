# SamePath

A discreet professional community for people navigating similar job
searches — not an interview-prep platform. SamePath matches people on
career-search compatibility (field, seniority, timing, availability)
while enforcing hard privacy rules that block same-company,
blocked-company, and corporate-group matches outright, and reveals
identity only progressively: nothing before mutual opt-in, and even after
a match, only what each person's own disclosure preference opted into.

## Implementation status

This is a working MVP, not a prototype with mocked data — every flow below
runs against a real Postgres database, has integration tests that exercise
it, and was verified live in a browser at least once during development.

**Built and working:**

- Passwordless email-code auth, full onboarding (manual profile entry *and*
  PDF/Word resume upload with automatic draft extraction — see
  [Resume upload](#resume-upload--extraction))
- The two-stage matching engine: hard privacy filters, then a transparent
  weighted compatibility score (see [Matching](#matching))
- Mutual opt-in connection flow, in-app messaging, meeting confirmation,
  blocking, and reporting
- Company normalization with fuzzy search, corporate-group modeling, and
  an admin merge tool
- Small private groups (4–6 people) with the same privacy guarantees as
  1:1 matching
- Optional (never mandatory) session guides
- A moderated, anonymous, community-contributed interview-experience
  library with a credit-reward system convertible to bonus access days
- A fixed-duration, non-auto-renewing access pass with a swappable
  payment-provider interface (fake/local implementation only — see
  [Adapters](#adapters))
- A full admin/moderation area (dashboard, contribution moderation,
  interview-library oversight, user/content reports, external takedown
  requests, group/guide/company management, reward-policy tuning,
  access-pass product configuration)
- Account data export and soft account deletion (PII-scrubbing, session
  revocation, resume-file deletion — never touches published,
  already-anonymous interview-library content; see
  [Unresolved legal/privacy items](#unresolved-legalprivacy-review-items))

**Deliberately not implemented (documented, not stubbed silently):**

- Real payment processing or SMS — both have a defined interface and a
  fake/local implementation, matching the build brief's explicit
  "fake/local impl only" scope. Upload scanning is structural
  (in-process), not signature-based antivirus. See
  [Adapters](#adapters) and `docs/security-hardening.md`.
- Any JobTracker Pro integration — `docs/jobtracker-integration.md` and
  `src/modules/integrations/jobtracker/types.ts` document a proposed
  boundary; nothing is wired up, imported, or callable.
- A background job queue — every "async" step (interview publication
  delay, access-pass expiry, resume extraction) runs lazily inline at the
  top of the relevant read/write path instead. Documented in
  `docs/architecture-decisions.md`.

**Material assumptions made without a real spec to check against** (flag
these to product/legal before launch): the ₪149 / 45-day access-pass price
and duration, the credit-reward amounts in `RewardPolicy` seed data
(tunable at runtime via `/admin/reward-policies`, not a deploy), the
14-day interview-library publication delay, and the shape of the
JobTracker Pro integration boundary (no real spec existed to build
against).

## Architecture

A modular monolith: Next.js 16 App Router (Turbopack, Cache Components
deliberately **off** — see `docs/architecture-decisions.md` #1), Postgres
via Prisma 7 with a driver adapter (`@prisma/adapter-pg`), TypeScript
throughout. Every domain lives under `src/modules/<name>/` with the same
internal shape:

- **Pure logic files** (no DB, no framework import) — fully unit-testable,
  and importable from plain scripts like `prisma/seed/*.ts`.
- **`service.ts`** — `server-only`, the real DB-backed logic.
- **`actions.ts`** — `"use server"`, thin zod validation + calls into
  `service.ts`, owns cookies/redirects/revalidation.
- Client components (`.tsx`) for anything interactive.

Full reasoning for the eight major architecture decisions (framework, DB,
local dev, auth, reference-data-as-rows, the shared `Tag` table, why
privacy/score internals are restricted tables, money-as-cents) is in
`docs/architecture-decisions.md` — read that before changing any of them.

### Domain modules (`src/modules/`)

| Module | Owns |
|---|---|
| `auth` | Passwordless email-code login/register, sessions |
| `profiles` | Onboarding, employment history, privacy/connection preferences, progressive-disclosure DTOs |
| `resumes` | PDF/Word upload, text extraction, deterministic parsing, draft review |
| `companies` | Canonical companies, aliases, corporate groups, fuzzy search |
| `privacy` | The hard-filter engine (`engine.ts`, pure) + DB-backed eligibility loading and audit logging |
| `matching` | Scoring (pure) + suggestion generation, mutual opt-in state machine |
| `connections` | Post-match messaging, meeting confirmation, blocking, reporting, suggested session structure |
| `groups` | Small private groups with the same privacy guarantees |
| `guides` | Optional, never-mandatory session guides (read path; authoring lives in `admin`) |
| `interviews` | Community-contributed interview-experience library: drafting, moderation queue, publication |
| `moderation` | Contribution approve/reject/remove, content-report resolution |
| `credits` | Reward calculation (pure) + ledger, idempotent grants, conversion to bonus access days |
| `access-passes` | Fixed-duration, non-auto-renewing access, lazy activation-on-first-event |
| `payments` | `PaymentProvider` interface + `FakePaymentProvider` |
| `account` | Data export, soft deletion |
| `admin` | The internal admin/moderation area — all of the above, plus reward-policy and access-product configuration |
| `reference-data` | Lookup-table reads (fields, roles, bands, regions, tags) |
| `notifications` | `Mailer` interface + console/SMTP adapters |
| `integrations/jobtracker` | Types-only, unimplemented — see above |

## Local development setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Get a local Postgres database — two options

**Option A (recommended, zero install): `prisma dev`.** Prisma ships a
local Postgres-compatible dev server with no Docker/Homebrew needed. It
runs over the standard Postgres wire protocol, so it's the same
`@prisma/adapter-pg` code path as any real deployment.

```bash
npx prisma dev --name samepath-dev --db-port 51214
```

**Critical:** you need a **second, separate** instance for the test suite
— `prisma dev`'s embedded engine does **not** isolate same-instance
databases from each other (two databases created on the same instance
share underlying storage, verified directly by writing a marker row into
one and reading it back from the other). Two databases on the same
`prisma dev` instance are not two databases for this purpose; two
separate named instances are.

```bash
npx prisma dev --name samepath-test --db-port 51218
```

Both instances persist and keep running in the background (`npx prisma
dev ls` lists them, `npx prisma dev stop <name>` stops one). You only run
these commands once per machine, not once per session.

**Option B: Docker Compose.** `docker compose up -d` starts a single real
Postgres container (`docker-compose.yml`, credentials `samepath`/
`samepath`, database `samepath_dev`, port 5432). Unlike `prisma dev`'s
engine, a real Postgres instance *does* correctly isolate multiple
databases on the same server, so for this option a second `CREATE
DATABASE samepath_test;` on the same container is fine — no second
container needed.

### 3. Configure environment files

```bash
cp .env.example .env
cp .env.test.example .env.test
```

Fill in `DATABASE_URL` in each to match whichever option you chose above
(both example files have the exact URL shape and a `SESSION_SECRET`
generator command inline). Every other variable has a working local
default — `.env.example` documents each one and which adapter it selects.

### 4. Migrate and seed

```bash
pnpm db:migrate   # prisma migrate dev
pnpm db:seed      # prisma/seed.ts — fictional companies, users, groups, guides
```

The seed data exercises the interesting privacy scenarios on purpose:
same-company and corporate-group pairs that must never match, a user who
blocked a former employer, differing seniority/availability, and an
`admin@example.com` (role `ADMIN`) account for reaching `/admin` — none of
it is real personal data. Every seeded user, including the admin, logs in
with the password `samepath-dev-password` (`SEED_DEV_PASSWORD` in
`prisma/seed/users.ts`).

### 5. Run it

```bash
pnpm dev
```

`http://localhost:3000`. Registration/login is email+password, plus a
"Continue with Google" button. `GOOGLE_OAUTH_ADAPTER` defaults to `"fake"`
in `.env`/`.env.test` so Google sign-in works out of the box with no real
credentials — it creates/logs in a canned test identity locally
(`src/modules/auth/google-oauth.ts`). To use real Google sign-in, create an
OAuth Client ID in Google Cloud Console (APIs & Services → Credentials →
Create Credentials → OAuth client ID → Web application), add
`http://localhost:3000/api/auth/google/callback` as an authorized redirect
URI, put the Client ID/Secret in `.env` as `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET`, and set `GOOGLE_OAUTH_ADAPTER="google"`.

## Testing

```bash
pnpm test          # vitest run — 253 tests across 25 files at last count
pnpm test:watch
pnpm typecheck      # next typegen && tsc --noEmit
pnpm lint
pnpm build          # production build
```

Integration tests run against the **real** `.env.test` database (not
mocks) and reset it with a full `TRUNCATE` between tests
(`src/shared/test/db.ts`), guarded to refuse running against anything
whose `DATABASE_URL` doesn't contain `samepath_test` — a real safety net,
not decoration. Because of that shared-database reset, `vitest.config.ts`
deliberately sets `fileParallelism: false`; test files run sequentially,
trading suite speed for correctness.

Pure logic (privacy engine, scoring, parsers, normalization, reward math)
has plain unit tests with no DB. `src/shared/test/fixtures.ts` has
reusable fixtures (`createTestUser`, `createTestCompany`,
`grantActiveAccessPass`) for the integration suite.

### End-to-end tests

```bash
pnpm dev            # in one terminal, or let Playwright launch it (below)
pnpm e2e             # playwright test
pnpm e2e:ui          # interactive UI mode
```

`e2e/` (Playwright, `playwright.config.ts`) drives a real browser against
the app running on the **local dev database** (`.env`, already seeded —
see "Local development setup"), not the vitest suite's throwaway
`.env.test` database: these specs need the seeded reference data (fields,
roles, tags, the `admin@example.com` account) to exercise real
forms, and vitest's per-test `TRUNCATE` reset would pull that data out
from under a running browser session. Each spec registers its own
throwaway user with a timestamped email, so runs don't collide with each
other or the seeded fictional accounts — this does mean repeated `pnpm
e2e` runs accumulate harmless extra users in the dev database over time.

Three specs cover the highest-value real-browser paths: the full manual
onboarding golden path (register -> profile -> privacy -> preferences ->
the authenticated app shell), the resume-upload alternative (upload a
real generated PDF, confirm the extraction pre-filled the form correctly,
submit), and the admin area (log in as the seeded admin, see real
dashboard metrics, create a guide end to end). The mutual-match/connection
flow is **not** covered at the e2e level — it needs two coordinated
sessions with deliberately compatible profiles, which is exercised
thoroughly at the integration-test level instead
(`matching/__tests__/service.integration.test.ts`); adding a true
two-browser e2e version is a reasonable next investment, not something
this pass got to.

Verification codes are never stored in plaintext anywhere (only a hash —
`EmailVerification.codeHash`), so there's no DB shortcut for reading one
in a test: `e2e/helpers/mail.ts` reads it back out of the dev server's
own console output, exactly like a human running `pnpm dev` would read it
off their terminal (the default `MAIL_ADAPTER=console`).

## Privacy model

The non-negotiable rules (enforced in `src/modules/privacy/engine.ts`, a
pure function with zero DB access so it's exhaustively unit-testable):

1. **Never** match two people at the same current company.
2. **Never** match if either has blocked the other's company.
3. **Corporate-group blocking**: blocking a company can optionally cascade
   to every company in its corporate group (parent/subsidiary/brand),
   per-user opt-in.
4. **Never** match two people who've blocked each other directly.
5. Every rejection is logged internally (`PrivacyDecisionAudit`) for
   admin/debugging visibility — the *reason* is never exposed to either
   user; a hidden match is just... not shown.
6. **No public profile discovery.** There is no browse/search-other-users
   surface anywhere in the app.
7. **Progressive identity disclosure**: `src/modules/profiles/dto.ts`'s
   `toPreMatchDTO`/`toPostMatchDTO` are pure functions where the pre-match
   type structurally cannot carry name or contact fields — it's not a
   filter that could be forgotten, the forbidden fields aren't in the input
   type. Employer is the one pre-match exception, and it's still gated: it
   only appears when the candidate's own `shareCompanyPreMatch` disclosure
   preference is on (default off), never based on what the viewer wants.
   Since every candidate reaching this DTO has already passed the hard
   filter above, this can only ever reveal a company neither side has
   already ruled out. Post-match, every other optional field is revealed
   the same way — gated by the *owning* user's own disclosure preference,
   never the viewer's.

`docs/architecture-decisions.md` #7 explains why `PrivacyDecisionAudit`
and `MatchScoreBreakdown` are separate, admin/test-only tables rather than
fields that could accidentally leak through a user-facing query.

## Matching

Two stages, always in this order (`src/modules/matching/`):

1. **Hard filter** — every candidate pair is run through the privacy
   engine first. A pair that fails never reaches scoring.
2. **Weighted compatibility score** — `scoring.ts` (pure,
   `DEFAULT_SCORING_WEIGHTS`) scores field/role overlap, seniority
   proximity, skills/domain tag overlap, and
   availability overlap into a single transparent score, plus
   `generateSafeReasons()` — human-readable reasons that never leak
   anything privacy-sensitive (never "you're both at Company X," always
   "similar backend experience level").

Mutual opt-in is a real state machine (`MatchStatus`): `PROPOSED ->
INTERESTED_BY_A/B -> MUTUALLY_ACCEPTED -> ACCESS_CHECK -> ACTIVE`, with
`DECLINED`/`EXPIRED` off-ramps. `ACCESS_CHECK` is where the access-pass
gate lives — see below.

### Suggested session structure

A real product gap surfaced during this build: matching two people is not
the same as making sure the *session* itself is worth either person's
time — without any structure, it's easy for one side's agenda to
dominate while the other leaves without what they came for. Once a
connection is active, its room offers a suggested, timed structure
(`SessionGuideStep.role`: `PRESENTER`/`LISTENER`/`BOTH`, plus
`durationMinutes`) picked from one of four categories: an intro video
call, project/architecture presentation, coding, and system design.
Picking one is a single click — a random published guide from that
category is attached to the `Connection` (`selectedGuideId`) so **both**
participants see the identical structure, not two different random
picks; it can be re-rolled or cleared any time. Coding guides are
collaborative (`BOTH` throughout, matching "work on a problem
together"); the other three use a presenter/listener/reflect/swap
structure (the intro guide keeps everything `BOTH`, since it's a shared
conversation, not a presentation). Still fully optional — same as every
other guide, nothing here is tracked for completion or required.

The same four categories double as `ConnectionReason` options in the
connection room's "what type of session this time?" picker
(`SessionTypeSelector` in `ConnectionRoom.tsx`) — each participant marks
independently, no agreement required. Picking the intro option
(`INTRO_VIDEO_CALL`) additionally auto-suggests the intro guide right
away (unless one is already selected), so a pair meeting for the first
time doesn't need a second click to see the get-to-know structure before
moving on to a more focused session type later.

Seed content (`prisma/seed/guides.ts`) uses genuinely common, publicly-
known interview questions (Two Sum, LRU Cache, a URL shortener, a rate
limiter, etc.) as a starter pool, not attributed to any real company's
actual question bank and not meant to be the final set — extend it via
the existing `/admin/guides` UI (category `intro` / `coding` /
`system-design` / `project-presentation`).

## Resume upload & extraction

Onboarding accepts a PDF or Word resume as an alternative to manual entry
(`src/modules/resumes/`). Upload runs mime/size validation, a malware-scan
gate (structural active-content inspection — see
`docs/security-hardening.md`), text extraction (`pdf-parse` for PDF,
`mammoth` for `.docx`), and a **pure, DB-free deterministic parser**
(`deterministic-parser.ts`) that heuristically finds date-ranged
employment positions and scans for known skill labels. None of
it is applied to the profile automatically — it lands in a
`ResumeExtractionDraft` that pre-fills the same `ProfileStepOneForm` used
for manual entry, so every extracted field is reviewed, correctable, or
deletable by the user before `saveProfileStepOne` ever runs. Confirming
records a `UserConfirmation` and deletes the original file by default
(kept only if the user explicitly opts in).

`pdf-parse` (via `pdfjs-dist`) resolves its worker module relative to its
own file location at runtime, which breaks once Turbopack bundles the
calling code into a server chunk — `next.config.ts`'s
`serverExternalPackages: ["pdf-parse"]` keeps it unbundled specifically to
avoid that failure mode. If you ever see "Setting up fake worker failed"
in the server log, that's the config entry to check first.

## Adapters

Every external integration point is a small interface with a real local
implementation and a documented (not silently missing) path to a real
one:

| Concern | Interface | Local impl | Env var |
|---|---|---|---|
| Mail | `Mailer` (`notifications/mailer.ts`) | `ConsoleMailer` (prints to stdout) | `MAIL_ADAPTER=console\|smtp` |
| File storage | `Storage` (`shared/storage.ts`) | `LocalStorage` (`.local-storage/`, git-ignored) | `STORAGE_ADAPTER=local\|s3` |
| Payments | `PaymentProvider` (`payments/provider.ts`) | `FakePaymentProvider` | `PAYMENT_PROVIDER=fake` |
| Resume parsing | — | Deterministic heuristic parser | `RESUME_PARSER=deterministic\|ai` |
| Malware scanning | `MalwareScanner` (`resumes/malware-scan.ts`) | Structural inspection (`file-inspection.ts`); `NoopScanner` for debugging | `MALWARE_SCANNER=heuristic\|noop` |
| Rate limiting | — | In-memory fixed window (`shared/rate-limit.ts`); Postgres-backed for prod | `RATE_LIMIT_ADAPTER=memory\|postgres` |

**Before any real deployment, at minimum:** switch `MAIL_ADAPTER` to
`smtp` (the console adapter prints verification codes to stdout — see
`docs/security-hardening.md`), set `STORAGE_ADAPTER=s3` with a private bucket
(required on Vercel, whose filesystem is read-only), and
keep `MALWARE_SCANNER=heuristic` (the default). `PAYMENT_PROVIDER` staying
`fake` is a hard product decision, not an oversight — no real payment
processing exists anywhere in this codebase, per the build brief's
explicit scope.

## Interview-library moderation & rewards

Contributions are anonymous end-to-end: `InterviewExperience.authorId` is
marked internal-only in the schema (`prisma/schema.prisma`, restricted to
moderation/reward services) and no public or library DTO ever selects it.
Flow: draft -> submit -> moderation queue (automated duplicate/
prohibited-content warnings surfaced to the moderator, never
auto-rejected) -> approve (schedules publication after a configurable
delay, default 14 days, so a contribution isn't traceable to "who
submitted right before this appeared") -> published. Reward credits
(`credits/rewards.ts`, pure) are granted idempotently
(`CreditLedgerEntry.idempotencyKey`) and convertible to bonus access days
through admin-tunable `RewardPolicy` rows — editable live at
`/admin/reward-policies`, not a deploy.

## Access passes & payments

A fixed-duration, **non-auto-renewing** pass. Purchase creates a
`PENDING_ACTIVATION` pass immediately; the clock only starts at the first
meaningful activation event (`checkAndActivateAccessGate` — first mutual
connection or first group join), not at purchase time, so paying early
never wastes days. `access-passes/service.ts` also has
`grantReplacementAccessPass` for support/refund scenarios, exposed to
admins at `/admin/access`.

## Admin & moderation area

`/admin` (role `MODERATOR` or `ADMIN` — `requireModerator`/`requireAdmin`
in `auth/session.ts`): dashboard metrics (aggregate only — privacy-filter
activity is reported as a count, never broken down by who was rejected),
contribution moderation queue, interview-library oversight (unpublish for
review / permanent removal), user- and content-report resolution,
external takedown-request handling, group and session-guide authoring,
company merge tooling, reward-policy tuning (raw JSON editor), and
access-pass product configuration plus a replacement-pass grant tool for
support cases.

## Future JobTracker Pro integration

Documented, not built — see [`docs/jobtracker-integration.md`](docs/jobtracker-integration.md)
for the proposed scope boundary (what could plausibly be shared with
explicit opt-in versus what must never cross a product boundary, chiefly
anything from `MatchSuggestion`/`Connection`/`Group`) and
`src/modules/integrations/jobtracker/types.ts` for the types-only
proposed shape. Nothing here is imported by the running app.

## Deployment requirements

None of this has been deployed publicly, and shouldn't be without going
through the items below first:

1. Real `DATABASE_URL` pointing at a managed Postgres instance; run `pnpm
   db:migrate` (or `prisma migrate deploy` in CI/CD) against it — never
   `pnpm db:seed` against production data.
2. A real, random `SESSION_SECRET` (32+ bytes) — never the example value.
3. `MAIL_ADAPTER=smtp` with real credentials — see
   [Adapters](#adapters); this one is not optional.
4. `STORAGE_ADAPTER=s3` pointed at a real private bucket (AWS S3 or any
   S3-compatible store such as Cloudflare R2 via `S3_ENDPOINT`).
5. `MALWARE_SCANNER=heuristic` (the default) — never `noop` in production.
6. `RATE_LIMIT_ADAPTER=postgres` (shared `rate_limit_buckets` table) the
   moment more than one server instance is running — always on Vercel.
7. A nonce-based script CSP — baseline headers (HSTS, `X-Frame-Options`,
   `frame-ancestors`, nosniff, etc.) are set in `next.config.ts`, but
   `script-src` isn't restricted yet.
8. A structured logger with PII redaction — today there's only two
   `console.error` calls, both PII-free by inspection, but there's no
   framework enforcing that stays true as the app grows.
9. Legal review — see the next section; several of these are launch
   blockers, not nice-to-haves.

Full status snapshot (what was actually checked, not assumed) is in
`docs/security-hardening.md`.

## Unresolved legal/privacy review items

These need an actual legal/privacy review before a public launch — flagged
here rather than silently assumed away:

- **No terms of service or privacy policy exist anywhere in this repo.**
  A community product handling employment history, resumes, and
  anonymous-but-internally-linked interview-library contributions needs
  both before real users sign up.
- **No age/eligibility gate.** Nothing in the registration flow checks
  age or employment eligibility.
- **No cookie-consent surface**, despite setting a session cookie on
  every login — jurisdiction-dependent whether that needs a banner.
- **Right-to-erasure vs. the interview-library, as a genuine open
  question, not a settled one.** `deleteAccount` deliberately does *not*
  cascade-delete published `InterviewExperience` rows — the reasoning
  (already anonymous in every user-facing surface, removing it degrades a
  shared resource for no privacy benefit to the deleted user) is
  documented in `account/service.ts`, but `authorId` is still retained
  internally, pointing at a user row now marked `DELETED`. Whether that
  satisfies a real erasure request under GDPR/CCPA is a legal judgment
  call, not an engineering one — get it reviewed before relying on it.
- **The credit-reward-to-access-days conversion** (`credits/rewards.ts`)
  is a value exchange for user-generated content. Whether that needs
  terms-of-service language, tax treatment, or falls under any
  sweepstakes/promotion regulation in a given jurisdiction hasn't been
  checked.
- **No data-processing agreements** with the sub-processors this app
  will depend on in production (SMTP provider, S3-compatible storage,
  any real payment/malware-scan provider) — can't be drafted until those
  providers are actually chosen.
- **Moderator/admin liability for user-generated content** (the
  interview-experience library) — standard UGC-hosting legal questions
  (notice-and-takedown obligations, safe-harbor eligibility) that this
  build didn't attempt to answer; `TakedownRequest` exists as the
  operational mechanism, not as a legal compliance guarantee.
- **Cross-border data transfer**, if a real deployment ends up using a
  storage or mail provider outside the same jurisdiction as its users —
  not evaluated since no real provider is selected yet.

## Production-readiness checklist

- [ ] Legal review of every item above
- [ ] `MAIL_ADAPTER=smtp` with real credentials
- [ ] `STORAGE_ADAPTER=s3` configured against a private bucket
- [x] Upload scanning (`MALWARE_SCANNER=heuristic`, structural — see `docs/security-hardening.md`)
- [ ] Real `PaymentProvider` implementation (explicit approval required —
      see the build brief's constraint against enabling real payments
      without it)
- [ ] Shared-store rate limiting if running >1 instance
- [ ] Security headers configured
- [x] Structured logging + PII redaction (`src/shared/logger.ts`, `src/instrumentation.ts`)
- [ ] Uptime monitor pointed at `/api/health`; log drain if Vercel's log retention is too short
- [ ] `pnpm audit` clean (or documented as dev-tooling-only, as it is
      today — see `docs/security-hardening.md`)
- [ ] Real `SESSION_SECRET`, never the example value, rotated per
      environment
- [ ] Terms of service + privacy policy published and linked
- [ ] Backups/point-in-time recovery configured on the production database
