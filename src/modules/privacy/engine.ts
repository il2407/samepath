// The privacy/eligibility hard-filter engine (spec §6 Stage A). Pure
// functions only — no DB, no framework imports — so every rule can be
// exhaustively unit tested with plain fixtures. A context loader (context.ts)
// is responsible for turning Prisma rows into the plain shapes below.
//
// SECURITY INVARIANT: this stage always runs, and always runs completely
// independently of any compatibility score. A caller must never compute a
// score before calling evaluatePrivacy, and must never let a high score
// substitute for an `allowed: true` result.
//
// The `reasonCode` on a rejection is for internal diagnostics and audit
// only (see PrivacyDecisionAudit) — no caller may put it in a response a
// user can see. The product rule is to simply omit the hidden candidate/
// group/session, never to explain why it's missing.

export type ConnectionFormat = "ONE_ON_ONE" | "GROUP" | "BOTH";

export interface AvailabilitySlot {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startMinute: number;
  endMinute: number;
}

export interface EligibilityProfile {
  userId: string;
  userStatus: "ACTIVE" | "PAUSED" | "SUSPENDED" | "DELETED";
  profileStatus: "DRAFT" | "PENDING_PRIVACY" | "INCOMPLETE" | "ACTIVE" | "PAUSED";
  emailVerified: boolean;
  accessExpired: boolean;
  currentCompanyId: string | null;
  currentCompanyConfirmed: boolean;
  currentCompanyCorporateGroupId: string | null;
  blockEntireCorporateGroup: boolean;
  blockedCompanyIds: string[];
  blockedUserIds: string[];
  connectionFormat: ConnectionFormat;
  timezone: string;
  availability: AvailabilitySlot[];
}

export interface PrivacyCheckInput {
  subject: EligibilityProfile;
  candidate: EligibilityProfile;
  /** Subject previously chose "never suggest this person again" about the candidate. */
  candidateNeverAgainBySubject: boolean;
  /** Candidate previously chose "never suggest this person again" about the subject. */
  subjectNeverAgainByCandidate: boolean;
  /** Omit for a general eligibility check; pass when evaluating a specific 1:1 or group suggestion. */
  requiredFormat?: "ONE_ON_ONE" | "GROUP";
}

export type PrivacyRejectionReason =
  | "same_user"
  | "subject_ineligible"
  | "candidate_ineligible"
  | "safety_restriction"
  | "same_company"
  | "corporate_group_conflict"
  | "company_blocked"
  | "user_blocked"
  | "never_again"
  | "incompatible_connection_type"
  | "no_availability_overlap";

export type PrivacyCheckResult =
  | { allowed: true }
  | { allowed: false; reasonCode: PrivacyRejectionReason };

function formatsCompatible(a: ConnectionFormat, b: ConnectionFormat, required?: "ONE_ON_ONE" | "GROUP"): boolean {
  if (required) {
    return (a === required || a === "BOTH") && (b === required || b === "BOTH");
  }
  if (a === "BOTH" || b === "BOTH") return true;
  return a === b;
}

function isIneligible(p: EligibilityProfile): boolean {
  return (
    p.userStatus === "DELETED" ||
    p.userStatus === "PAUSED" ||
    p.profileStatus !== "ACTIVE" ||
    !p.emailVerified ||
    p.accessExpired
  );
}

/** True only when both sides share a timezone — see hasAvailabilityOverlap for why. */
function slotsOverlap(a: AvailabilitySlot[], b: AvailabilitySlot[]): boolean {
  return a.some((slotA) =>
    b.some(
      (slotB) =>
        slotA.dayOfWeek === slotB.dayOfWeek &&
        slotA.startMinute < slotB.endMinute &&
        slotB.startMinute < slotA.endMinute,
    ),
  );
}

/**
 * Hard-filters a candidate as a match for the subject. Cross-timezone
 * comparisons are treated as "cannot determine" and pass this gate — real
 * cross-timezone distance is left to the Stage B compatibility score, since
 * turning a recurring weekly pattern into another timezone is inherently
 * approximate around DST boundaries. Same-timezone users (the overwhelming
 * majority for the v1 Israel-first launch) get a real, exact check.
 */
export function hasAvailabilityOverlap(
  subjectTimezone: string,
  subjectSlots: AvailabilitySlot[],
  candidateTimezone: string,
  candidateSlots: AvailabilitySlot[],
): boolean {
  if (subjectSlots.length === 0 || candidateSlots.length === 0) return true;
  if (subjectTimezone !== candidateTimezone) return true;
  return slotsOverlap(subjectSlots, candidateSlots);
}

export function evaluatePrivacy(input: PrivacyCheckInput): PrivacyCheckResult {
  const { subject, candidate } = input;

  if (subject.userId === candidate.userId) {
    return { allowed: false, reasonCode: "same_user" };
  }

  if (subject.userStatus === "SUSPENDED" || candidate.userStatus === "SUSPENDED") {
    return { allowed: false, reasonCode: "safety_restriction" };
  }
  if (isIneligible(subject)) return { allowed: false, reasonCode: "subject_ineligible" };
  if (isIneligible(candidate)) return { allowed: false, reasonCode: "candidate_ineligible" };

  const subjectCompany = subject.currentCompanyConfirmed ? subject.currentCompanyId : null;
  const candidateCompany = candidate.currentCompanyConfirmed ? candidate.currentCompanyId : null;

  if (subjectCompany && candidateCompany && subjectCompany === candidateCompany) {
    return { allowed: false, reasonCode: "same_company" };
  }

  const subjectGroup = subject.currentCompanyConfirmed ? subject.currentCompanyCorporateGroupId : null;
  const candidateGroup = candidate.currentCompanyConfirmed ? candidate.currentCompanyCorporateGroupId : null;
  if (
    subjectGroup &&
    candidateGroup &&
    subjectGroup === candidateGroup &&
    (subject.blockEntireCorporateGroup || candidate.blockEntireCorporateGroup)
  ) {
    return { allowed: false, reasonCode: "corporate_group_conflict" };
  }

  if (
    (candidateCompany && subject.blockedCompanyIds.includes(candidateCompany)) ||
    (subjectCompany && candidate.blockedCompanyIds.includes(subjectCompany))
  ) {
    return { allowed: false, reasonCode: "company_blocked" };
  }

  if (
    subject.blockedUserIds.includes(candidate.userId) ||
    candidate.blockedUserIds.includes(subject.userId)
  ) {
    return { allowed: false, reasonCode: "user_blocked" };
  }

  if (input.candidateNeverAgainBySubject || input.subjectNeverAgainByCandidate) {
    return { allowed: false, reasonCode: "never_again" };
  }

  if (!formatsCompatible(subject.connectionFormat, candidate.connectionFormat, input.requiredFormat)) {
    return { allowed: false, reasonCode: "incompatible_connection_type" };
  }

  if (
    !hasAvailabilityOverlap(subject.timezone, subject.availability, candidate.timezone, candidate.availability)
  ) {
    return { allowed: false, reasonCode: "no_availability_overlap" };
  }

  return { allowed: true };
}
