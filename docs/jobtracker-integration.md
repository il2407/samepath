# Future JobTracker Pro integration boundary (spec §9B)

**Status: not implemented.** This document and the type definitions in
`src/modules/integrations/jobtracker/types.ts` exist to record a considered
boundary for a *future* integration with JobTracker Pro (a companion job-
application-tracking product) — no client, sync job, API route, or UI
surface exists for it anywhere in this codebase. Nothing in the app
imports the types file; it compiles and is covered by nothing else,
intentionally.

This is written from the product boundary described in the build brief,
not from a JobTracker Pro API spec (none was provided). Treat the shapes
below as a starting proposal to validate against the real product when
that integration is actually scoped, not as an agreed contract.

## Why document this now, and why not build it

SamePath's entire value proposition rests on the privacy model in
`docs/architecture-decisions.md` and the matching-engine hard filters: no
public profile discovery, no identity before mutual opt-in, and even after
a mutual match only what the *other* person's own disclosure preference
opted into. Any cross-product integration is a new way for identity or
match data to leave that boundary, so it has to be designed deliberately
rather than bolted on as a convenience API. Building it before there's a
real counterpart product to integrate with would mean guessing at a
contract twice — once now, wrong, and once for real later.

## What could plausibly cross the boundary, and what must never

**Plausibly shareable, with explicit per-user opt-in:**

- The canonical company list (`Company.canonicalName` + aliases) — this is
  reference data, not personal data, and keeping it in sync would reduce
  duplicate data entry for a user active on both products.
- Published, already-anonymous interview-library content
  (`InterviewExperience` once `PUBLISHED`) — it's already public within
  SamePath and carries no author identity by design (`authorId` is
  internal-only; see the schema comment on `InterviewExperience`).
- A user's own `ProfessionalField` / `TargetRole` / `SeniorityBand`
  selections, if JobTracker Pro wants to pre-fill a similar onboarding step
  — but only pushed *from* SamePath *to* JobTracker Pro with the user
  initiating the sync, never pulled automatically.

**Must never cross the boundary, under any design:**

- Anything from `MatchSuggestion`, `Connection`, or `Group` — these encode
  who matched with whom, which is exactly the information the privacy
  engine exists to protect. An integration that leaks match graphs through
  a side channel defeats the entire product.
- Pre-match identity fields (real name, employer, contact info) — the same
  progressive-disclosure rule that applies inside SamePath must apply
  across the boundary. JobTracker Pro should only ever receive what the
  *user themself* is looking at in their own account, never another user's
  data reachable through them.
- `PrivacyDecisionAudit` rows, blocked-company/blocked-user lists, or
  anything else that would tell a counterpart system who someone is trying
  to avoid.

## Proposed shape (types only, `src/modules/integrations/jobtracker/types.ts`)

- `JobTrackerSyncScope` — an explicit enum of what a user has opted to
  share (`COMPANY_DIRECTORY`, `PUBLISHED_INTERVIEW_LIBRARY`,
  `OWN_PROFESSIONAL_BASICS`), so consent is scoped and auditable rather
  than all-or-nothing.
- `JobTrackerLinkedAccount` — records that a user has connected an
  account, with a token reference (never the token itself in this shape)
  and the granted scopes; modeled as an interface only, no corresponding
  Prisma model exists yet.
- `JobTrackerExportPayload` — the read-only shape SamePath would hand over
  for a given scope, built from data that's already public or already the
  requesting user's own.

## What real implementation would still need to decide

- Authentication model between the two products (OAuth-style token
  exchange is the obvious default, but which product is the authorization
  server is an open product question).
- Whether sync is push (SamePath notifies JobTracker Pro on change),
  pull (JobTracker Pro polls a scoped export endpoint), or user-triggered
  one-shot export — this MVP takes no position.
- Rate limiting and abuse posture for whatever endpoint eventually serves
  `JobTrackerExportPayload`, following the same pattern as
  `docs/security-hardening.md`.
- A revocation flow: a user must be able to unlink and have every
  previously-shared scope stop being served, not just stop being written
  going forward.

None of this is scheduled. This document's only job is to make sure that
*if* it gets built, the privacy boundary is the first design constraint,
not an afterthought.
