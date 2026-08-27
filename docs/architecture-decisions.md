# Architecture decision record

This file records the decisions made while turning an empty repository into
the SamePath MVP, and why. It is written once, up front, and appended to only
when a later decision reverses or materially changes one of these.

## 0. Starting point

The repository was empty — no existing landing page, no established
architecture. The build follows the spec's fallback for this case: a
production-minded TypeScript modular monolith, not a rebuild of anything.

## 1. Framework: Next.js 16 App Router, Cache Components off

Next.js 16 ships a new opt-in rendering model ("Cache Components" /
`cacheComponents: true`) that requires every route to explicitly resolve
`cookies()`/`headers()`/uncached data behind `<Suspense>` or `"use cache"` to
produce a static shell. SamePath is almost entirely authenticated, per-user,
dynamic content (dashboard, matches, connections, groups, admin) — there is
very little to statically prerender, so the optimization Cache Components
buys doesn't apply, and turning it on would mean wrapping dozens of routes in
Suspense boundaries purely to satisfy the build. Cache Components stays off;
routes render dynamically the traditional way, matching Next.js's
pre-16 model.

## 2. Database: PostgreSQL via Prisma 7, driver-adapter client

Prisma 7 requires an explicit driver adapter (`@prisma/adapter-pg` + `pg`)
rather than the old bundled engine. This is a strict requirement, not a
choice — `PrismaClient` will not connect to Postgres without it.

## 3. Local database: `prisma dev`, Docker Compose as the parity alternative

Prisma ships `prisma dev`, which runs a real Postgres-compatible database
locally with no Docker or Homebrew install, over the standard Postgres wire
protocol (so the same `@prisma/adapter-pg` code path is used in every
environment). This became the primary local dev path — it is genuinely the
"one documented command after dependency installation" the spec asks for.
`docker-compose.yml` is still provided (per the spec's explicit requirement)
for teams who want a persistent, standard Postgres instance instead.

## 4. Auth: passwordless email code, not a password flow

The spec allows either. Passwordless was chosen because it removes an entire
class of risk (password storage, reset flows, credential stuffing) for a
community product where the email is already a personal, verified identity
anchor. The `AuthIdentity` table still carries a `passwordHash` column so a
password method could be added later without a migration.

## 5. Reference data as rows, not enums

`ProfessionalField`, `TargetRole`, `SeniorityBand`, `Language`, `Region` are
lookup tables, not Prisma enums, per the spec's explicit requirement that new
professions/countries/languages/seniority bands be addable "without rewriting
the platform." A Prisma enum requires a migration to add a value; a table
row does not.

## 6. Skills, domains, and interview topics share one `Tag` table

The compatibility engine's spec explicitly scores "skills/domains overlap"
as a single combined 10% bucket, and interview-library topics need the same
"tag a thing with zero or more labels" shape. A single `Tag(kind: SKILL |
DOMAIN | TOPIC)` table with join tables per owner (`ProfileTag`,
`InterviewExperienceTopic`, `InterviewQuestionTopic`) avoids three near-
identical lookup tables while keeping each relationship independently
queryable and indexable.

## 7. Privacy and reward-score internals are separate, restricted tables

`PrivacyDecisionAudit` and `MatchScoreBreakdown` exist specifically so the
"why" of a privacy rejection or a match score is inspectable by admins/tests
without ever being reachable from a user-facing DTO. No user-facing query
path selects these tables; only admin/diagnostic and test code does. This is
the schema-level backing for the spec's "never reveal why a candidate/group/
session was hidden" and "expose only safe human-readable reasons" rules.

## 8. Money as integer cents; lifecycle states as enums

`Payment.amountCents` / `ProductConfiguration.priceCents` avoid float
rounding issues. All lifecycle fields (`MatchStatus`, `ExperienceStatus`,
`AccessPassStatus`, `PaymentStatus`, etc.) are Prisma enums matching the
state machines specified, not free strings — invalid transitions become a
type error, not a runtime surprise.
