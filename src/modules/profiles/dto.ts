// Progressive-disclosure DTO mapping (spec §4). Pure functions only — no DB,
// no framework — so the pre-match/mid-stage/post-match boundary is directly
// testable without a database. This is the single place allowed to decide
// what a candidate's data looks like to someone else; every route that shows
// a candidate/match/connection must go through toPreMatchDTO, toMidStageDTO,
// or toPostMatchDTO, never select raw profile fields directly into a
// response.
//
// THREE DISCLOSURE STAGES (backlog item 9 — progressive identity disclosure):
//
//   1. PRE_MATCH   — MatchStatus PROPOSED/INTERESTED_BY_A/INTERESTED_BY_B.
//                     toPreMatchDTO(). No Connection exists yet.
//   2. MID_STAGE   — MatchStatus MUTUALLY_ACCEPTED/ACCESS_CHECK (both sides
//                     said INTERESTED, but a real Connection has not been
//                     created yet — see matching/service.ts). toMidStageDTO().
//   3. CONNECTED   — MatchStatus ACTIVE, a real Connection row exists.
//                     toPostMatchDTO().
//
// VISIBILITY MATRIX (source of truth — keep this in sync with the functions
// below; also reproduced in the WS3 final report):
//
//   Field                | Pre-match          | Mid-stage           | Connected (final)
//   ---------------------|--------------------|----------------------|--------------------
//   Anonymous nickname   | always (client)    | always (client)      | fallback only*
//   Years of experience  | always (computed)  | always (computed)    | always (computed)
//   Profile photo        | never              | never                | owner's sharePhotoPostMatch**
//   First name           | never              | owner's shareFullNamePostMatch (early opt-in) | automatic
//   Full name            | never              | never                | automatic
//   Current employer     | reciprocal opt-in***| reciprocal opt-in***| automatic
//   Location             | never              | never                | automatic
//   Email                | never              | never                | owner's shareEmailPostMatch (default off)
//   Phone                | never              | never                | owner's sharePhonePostMatch (default off)
//   LinkedIn             | never              | never                | automatic
//
//   *  The nickname is a system-generated, per-suggestion persona, not part
//      of this DTO at all (see matching/service.ts SuggestionView.codeName /
//      connections/service.ts resolveDisplayName) — callers fall back to it
//      whenever a name field here is null.
//   ** sharePhotoPostMatch/photoStorageKey are read by
//      connections/service.ts directly (photo bytes never pass through this
//      pure, storage-free layer) — out of WS3's scope, unaffected here.
//   *** Reciprocal: visible only when BOTH the viewer's own and the
//       candidate's own shareCompanyPreMatch are true (backlog item 8).
//
// DESIGN DECISION — automatic reveal at the CONNECTED stage (backlog item
// 10, "remove per-field selection after final approval"; revised once more
// for contact-info specifically, see below):
//
//   Once a real Connection exists, full name, employer, and location are
//   revealed unconditionally — sharePreciseLocationPostMatch and the
//   employer's pre-match toggle are no longer consulted at this stage.
//   Reaching ACTIVE already requires: both sides independently said
//   INTERESTED, the privacy hard-filter passed a second time, and both sides
//   cleared the access-pass gate — a materially stronger, mutual signal than
//   any single checkbox. See the WS3 final report's "known limitations" for
//   the full reasoning and the product sign-off this assumption should get
//   before a real launch.
//
//   Email and phone are the deliberate exception to that automatic reveal:
//   product decided contact info (as opposed to identity info like name/
//   employer/LinkedIn) should only ever be shared at the profile owner's own
//   later initiative, never automatically just because a connection exists.
//   shareEmailPostMatch/sharePhonePostMatch are therefore live, owner-only
//   preferences (default off, per architecture-decisions.md #7/#10 — the
//   *owner's* preference gates their own field, never the viewer's) that a
//   user can enable any time from settings, including well after the
//   connection was already made. LinkedIn is not treated as contact info for
//   this purpose — see the LinkedIn note below.
//
//   shareFullNamePostMatch is the one exception kept alive as a live,
//   user-facing preference — repurposed as "reveal my first name already at
//   the mutual-interest stage, before the connection is even created."
//   Column name is unchanged (no migration — see the don't-remove-things
//   convention), only its UI framing and the moment it's consulted changed.
//
// LinkedIn (backlog item 11/12, revised again — product decision): disclosure
// must be mutual and complete the moment a Connection exists, with no
// intermediate, partially-revealed state and no separate approval step
// beyond reaching CONNECTED. LinkedIn is therefore folded into the same
// automatic reveal as full name/employer/location (see the stage-10 "DESIGN
// DECISION" above) rather than kept as its own opt-in — shareLinkedInPostMatch
// is no longer consulted here. This is unaffected by the email/phone
// carve-out above: LinkedIn is a public professional profile, not a direct
// contact channel, so it stays automatic. Never shown pre-match or
// mid-stage. Null only when no URL was ever entered (never fabricated).
//
// Years of experience (product decision): a computed, non-identifying
// number derived from ProfessionalProfile.experienceMonths (already
// maintained by onboarding/profile-update — see auth/service.ts and
// profiles/service.ts). Shown unconditionally from the pre-match stage
// onward — unlike `company`, a number of years reveals no specific employer
// and was explicitly scoped to stay out of full employment-history
// disclosure (backlog item 8's reciprocal opt-in for `company` is
// unaffected).

const dayLabels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function blockLabel(startMinute: number): string {
  if (startMinute < 720) return "בוקר";
  if (startMinute < 1020) return "צהריים";
  return "ערב";
}

export interface AvailabilitySlotData {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export function formatAvailabilitySummary(slots: AvailabilitySlotData[]): string[] {
  return slots
    .map((s) => `${dayLabels[s.dayOfWeek]} ${blockLabel(s.startMinute)}`)
    // de-dupe while preserving order
    .filter((label, index, all) => all.indexOf(label) === index);
}

export interface RawProfileForDto {
  currentRoleTitle?: string | null;
  professionalField: { labelHe: string } | null;
  seniorityBand: { labelHe: string } | null;
  targetRoles: { labelHe: string }[];
  tags: { labelHe: string }[];
  shortIntro: string | null;
  connectionPreference: {
    format: "ONE_ON_ONE" | "GROUP" | "BOTH";
    cadence: "ONE_TIME" | "RECURRING" | "BOTH";
    mode: "ONLINE" | "IN_PERSON" | "BOTH";
    reasons: string[];
  } | null;
  availabilitySlots: AvailabilitySlotData[];
  region: { labelHe: string } | null;
  company: { canonicalName: string } | null;
  /** ProfessionalProfile.cvVerifiedAt — see toPreMatchDTO.cvVerified. */
  cvVerifiedAt: Date | null;
  /** ProfessionalProfile.experienceMonths — see toPreMatchDTO.yearsOfExperience. */
  experienceMonths: number;
  disclosurePreference: {
    /**
     * Free-text, owner-entered. There is no separate structured first-name
     * column (see the migration 20260907074132_remove_pre_match_display_choice
     * that removed an earlier first-name-shaped field) — deriveFirstName()
     * below derives a first name from this at read time instead of adding
     * one.
     */
    fullName: string | null;
    shareCompanyPreMatch: boolean;
    shareFullNamePostMatch: boolean;
    photoStorageKey: string | null;
    photoMimeType: string | null;
    sharePhotoPostMatch: boolean;
    phoneNumber: string | null;
    linkedInUrl: string | null;
    shareLinkedInPostMatch: boolean;
    shareEmailPostMatch: boolean;
    sharePhonePostMatch: boolean;
  } | null;
  userEmail: string;
}

export interface PreMatchCandidateDTO {
  professionalField: string | null;
  seniorityBand: string | null;
  targetRoles: string[];
  skillsAndDomains: string[];
  shortIntro: string;
  connectionFormat: string;
  connectionCadence: string;
  connectionMode: string;
  reasons: string[];
  availabilitySummary: string[];
  /**
   * Null unless BOTH sides opted into `shareCompanyPreMatch` — the
   * candidate's own preference AND the viewer's own preference (backlog
   * item 8: reciprocal visibility, never unilateral). Every candidate
   * reaching this DTO has already passed the privacy hard filter (never
   * same company, never a company either side blocked), so revealing it
   * here only ever surfaces an employer neither side has ruled out — but
   * it's still both owning users' opt-in, never automatic and never based
   * on only one side's preference.
   */
  company: string | null;
  /**
   * True once the candidate uploaded a CV and confirmed the extracted
   * draft into their profile (see ProfessionalProfile.cvVerifiedAt) — a
   * trust signal shown before mutual approval alongside the other
   * categorical fields. Unlike `company`, this isn't an opt-in disclosure:
   * it reveals nothing identifying, only that the profile's info was
   * cross-checked against a real document at least once.
   */
  cvVerified: boolean;
  /**
   * Total years of professional experience, derived from
   * ProfessionalProfile.experienceMonths (rounded down). Null when the
   * profile has no recorded experience at all (0 months) — distinguishing
   * "hasn't told us" from "zero years" is not something this field can do,
   * so 0 months renders as null rather than a misleading "0 years".
   * Unconditional, unlike `company`: a duration alone doesn't identify an
   * employer.
   */
  yearsOfExperience: number | null;
}

/**
 * Everything visible before mutual approval. Deliberately does NOT accept
 * (and therefore cannot leak) name, photo, resume, email, phone, LinkedIn,
 * or precise location — those fields simply aren't part of the input shape
 * this function reads from. There is no display name here at all: the UI
 * shows a system-generated nickname + avatar emoji instead (see
 * src/modules/profiles/nickname.ts), seeded from the match suggestion, never
 * from profile data.
 *
 * Employer is the one exception, and it's reciprocal (backlog item 8): it
 * only appears when BOTH the candidate's own `shareCompanyPreMatch` AND the
 * viewer's own `shareCompanyPreMatch` are true — never based on only one
 * side's preference. `viewerShareCompanyPreMatch` must be loaded fresh for
 * the specific person viewing this candidate (see
 * dto-loader.ts#loadViewerShareCompanyPreMatch) — never hardcoded or
 * defaulted to true, or the reciprocal guarantee silently degrades back to
 * the old unilateral behavior.
 */
export function toPreMatchDTO(raw: RawProfileForDto, viewerShareCompanyPreMatch: boolean): PreMatchCandidateDTO {
  const companyVisible = viewerShareCompanyPreMatch && Boolean(raw.disclosurePreference?.shareCompanyPreMatch);
  return {
    professionalField: raw.professionalField?.labelHe ?? null,
    seniorityBand: raw.seniorityBand?.labelHe ?? null,
    targetRoles: raw.targetRoles.map((r) => r.labelHe),
    skillsAndDomains: raw.tags.map((t) => t.labelHe),
    shortIntro: raw.shortIntro ?? "",
    connectionFormat: raw.connectionPreference?.format ?? "BOTH",
    connectionCadence: raw.connectionPreference?.cadence ?? "BOTH",
    connectionMode: raw.connectionPreference?.mode ?? "BOTH",
    reasons: raw.connectionPreference?.reasons ?? [],
    availabilitySummary: formatAvailabilitySummary(raw.availabilitySlots),
    company: companyVisible ? (raw.company?.canonicalName ?? null) : null,
    cvVerified: Boolean(raw.cvVerifiedAt),
    yearsOfExperience: raw.experienceMonths > 0 ? Math.floor(raw.experienceMonths / 12) : null,
  };
}

/**
 * Derives a "first name" from the free-text `fullName` field — there is no
 * structured first-name column to prefer (see the note on
 * RawProfileForDto.disclosurePreference.fullName), and adding one would be a
 * needless, data-loss-risk migration for a cosmetic gain (the exact kind of
 * feature migration 20260907074132_remove_pre_match_display_choice already
 * undid once).
 *
 * Known, documented limitations (backlog item 17/19 — handled gracefully,
 * never a crash or an empty string):
 * - null / empty / whitespace-only `fullName` -> null. The caller (see
 *   toMidStageDTO) must fall back to the anonymous nickname, exactly as the
 *   pre-match UI already does when there's nothing to show.
 * - A single-word name (no space) -> that whole word, e.g. "Cher" -> "Cher".
 *   There's nothing to split, so the "first name" is just the value as-is.
 * - Naming conventions where the family name comes first (common in some
 *   East Asian languages, for example) will have the wrong token picked as
 *   "first" — there is no reliable way to detect this from a free-text
 *   field without asking the user to structure their name, which this
 *   backlog item explicitly chose not to do. This is a known, accepted
 *   limitation, not a bug.
 */
export function deriveFirstName(fullName: string | null): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

export interface MidStageCandidateDTO extends PreMatchCandidateDTO {
  /**
   * First name only, shown once mutual interest exists (MatchStatus
   * MUTUALLY_ACCEPTED / ACCESS_CHECK) but before a real Connection has been
   * created. Null when the candidate hasn't opted into
   * `shareFullNamePostMatch` (repurposed as "reveal my first name early" —
   * see the design note at the top of this file), when `fullName` is
   * empty/null, or for old accounts that never set one. Callers must fall
   * back to the same anonymous nickname used pre-match (see
   * matching/service.ts) when this is null — never render an empty string.
   *
   * Gating this on the candidate's own disclosure preference, rather than
   * making it unconditional the moment mutual interest exists, is a
   * deliberate reading of the backlog text ("after initial mutual
   * interest: first name only" — not "regardless of consent"): reaching
   * this *stage* unlocks an early reveal of a consent the candidate already
   * had to opt into, it does not create a new form of forced disclosure.
   */
  firstName: string | null;
}

/**
 * The mid-stage view: everything toPreMatchDTO shows, plus (gated) first
 * name. Used for MatchStatus MUTUALLY_ACCEPTED/ACCESS_CHECK — after both
 * sides said INTERESTED, but before a real Connection row exists. See
 * matching/service.ts for the query that surfaces this on /app/matches.
 */
export function toMidStageDTO(raw: RawProfileForDto, viewerShareCompanyPreMatch: boolean): MidStageCandidateDTO {
  const d = raw.disclosurePreference;
  return {
    ...toPreMatchDTO(raw, viewerShareCompanyPreMatch),
    firstName: d?.shareFullNamePostMatch ? deriveFirstName(d.fullName) : null,
  };
}

export interface PostMatchCandidateDTO extends PreMatchCandidateDTO {
  currentRoleTitle?: string | null;
  fullName: string | null;
  region: string | null;
  /** Owner's own shareEmailPostMatch (default off) — see the email/phone carve-out note at the top of this file. Never automatic. */
  email: string | null;
  /** Owner's own sharePhonePostMatch (default off) — same carve-out as email. Never automatic. */
  phoneNumber: string | null;
  /**
   * Automatic once a Connection exists, same as full name/employer/location —
   * see the "LinkedIn" note at the top of this file. Null only when the
   * candidate never entered a URL, never fabricated. Unlike email/phone,
   * LinkedIn is not gated by an owner preference here.
   */
  linkedInUrl: string | null;
}

/**
 * The final, CONNECTED-stage view — only ever call this once a real
 * Connection exists (MatchStatus ACTIVE). Full name, employer, location, and
 * LinkedIn are all revealed automatically at this stage — see the "DESIGN
 * DECISION — automatic reveal" and "LinkedIn" notes at the top of this file.
 * Email and phone are the exception: they stay gated behind the owner's own
 * shareEmailPostMatch/sharePhonePostMatch (default off) so contact info is
 * only ever shared at the owner's later initiative, not automatically.
 */
export function toPostMatchDTO(raw: RawProfileForDto): PostMatchCandidateDTO {
  // viewerShareCompanyPreMatch: true — at the CONNECTED stage employer
  // reveal is automatic like every other identity field here, not gated by
  // the pre-match reciprocal-consent mechanism (that mechanism exists to
  // guard *before* a Connection exists; it would be inconsistent to keep
  // gating it here while full name/location are already automatic).
  const pre = toPreMatchDTO(raw, true);
  const d = raw.disclosurePreference;
  return {
    ...pre,
    company: raw.company?.canonicalName ?? null,
    currentRoleTitle: raw.currentRoleTitle ?? null,
    fullName: d?.fullName ?? null,
    region: raw.region?.labelHe ?? null,
    email: d?.shareEmailPostMatch ? raw.userEmail : null,
    phoneNumber: d?.sharePhonePostMatch ? (d?.phoneNumber ?? null) : null,
    linkedInUrl: d?.linkedInUrl ?? null,
  };
}
