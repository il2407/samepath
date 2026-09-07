// Progressive-disclosure DTO mapping (spec §4). Pure functions only — no DB,
// no framework — so the pre-match/post-match boundary is directly testable
// without a database. This is the single place allowed to decide what a
// candidate's data looks like to someone else; every route that shows a
// candidate/match must go through toPreMatchDTO or toPostMatchDTO, never
// select raw profile fields directly into a response.

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
  professionalField: { labelHe: string } | null;
  seniorityBand: { labelHe: string } | null;
  targetRoles: { labelHe: string }[];
  tags: { labelHe: string }[];
  languages: { labelHe: string }[];
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
  disclosurePreference: {
    fullName: string | null;
    shareCompanyPreMatch: boolean;
    shareFullNamePostMatch: boolean;
    photoStorageKey: string | null;
    photoMimeType: string | null;
    sharePhotoPostMatch: boolean;
    shareLinkedInPostMatch: boolean;
    linkedInUrl: string | null;
    sharePreciseLocationPostMatch: boolean;
    shareEmailPostMatch: boolean;
    sharePhonePostMatch: boolean;
    phoneNumber: string | null;
  } | null;
  userEmail: string;
}

export interface PreMatchCandidateDTO {
  professionalField: string | null;
  seniorityBand: string | null;
  targetRoles: string[];
  skillsAndDomains: string[];
  languages: string[];
  shortIntro: string;
  connectionFormat: string;
  connectionCadence: string;
  connectionMode: string;
  reasons: string[];
  availabilitySummary: string[];
  /**
   * Null unless the candidate explicitly opted into `shareCompanyPreMatch`.
   * Every candidate reaching this DTO has already passed the privacy hard
   * filter (never same company, never a company either side blocked), so
   * revealing it here only ever surfaces an employer neither side has ruled
   * out — but it's still the owning user's opt-in, never automatic.
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
}

/**
 * Everything visible before mutual approval. Deliberately does NOT accept
 * (and therefore cannot leak) name, photo, resume, email, phone, LinkedIn,
 * or precise location — those fields simply aren't part of the input shape
 * this function reads from. There is no display name here at all: the UI
 * shows a system-generated nickname + avatar emoji instead (see
 * src/modules/profiles/nickname.ts), seeded from the match suggestion, never
 * from profile data. Employer is the one exception, and only when the
 * candidate explicitly opted into `shareCompanyPreMatch`; every candidate
 * reaching this function already passed the privacy hard filter, so this can
 * only ever reveal a company neither side has ruled out.
 */
export function toPreMatchDTO(raw: RawProfileForDto): PreMatchCandidateDTO {
  return {
    professionalField: raw.professionalField?.labelHe ?? null,
    seniorityBand: raw.seniorityBand?.labelHe ?? null,
    targetRoles: raw.targetRoles.map((r) => r.labelHe),
    skillsAndDomains: raw.tags.map((t) => t.labelHe),
    languages: raw.languages.map((l) => l.labelHe),
    shortIntro: raw.shortIntro ?? "",
    connectionFormat: raw.connectionPreference?.format ?? "BOTH",
    connectionCadence: raw.connectionPreference?.cadence ?? "BOTH",
    connectionMode: raw.connectionPreference?.mode ?? "BOTH",
    reasons: raw.connectionPreference?.reasons ?? [],
    availabilitySummary: formatAvailabilitySummary(raw.availabilitySlots),
    company: raw.disclosurePreference?.shareCompanyPreMatch ? (raw.company?.canonicalName ?? null) : null,
    cvVerified: Boolean(raw.cvVerifiedAt),
  };
}

export interface PostMatchCandidateDTO extends PreMatchCandidateDTO {
  fullName: string | null;
  linkedInUrl: string | null;
  region: string | null;
  email: string | null;
  phoneNumber: string | null;
}

/**
 * Everything from toPreMatchDTO, plus each optional field ONLY when the
 * candidate's own disclosurePreference explicitly opted into revealing it —
 * never based on what the viewer wants to see.
 */
export function toPostMatchDTO(raw: RawProfileForDto): PostMatchCandidateDTO {
  const d = raw.disclosurePreference;
  return {
    ...toPreMatchDTO(raw),
    fullName: d?.shareFullNamePostMatch ? (d.fullName ?? null) : null,
    linkedInUrl: d?.shareLinkedInPostMatch ? (d.linkedInUrl ?? null) : null,
    region: d?.sharePreciseLocationPostMatch ? (raw.region?.labelHe ?? null) : null,
    email: d?.shareEmailPostMatch ? raw.userEmail : null,
    phoneNumber: d?.sharePhonePostMatch ? (d.phoneNumber ?? null) : null,
  };
}
