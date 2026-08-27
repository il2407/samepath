// Stage B: compatibility scoring (spec §6). Pure, deterministic, and
// completely separate from the privacy engine — this file is only ever
// consulted AFTER evaluatePrivacy has already allowed the pair. Weights are
// one central, named config object, not numbers scattered through the file.

export interface ScoringWeights {
  targetRole: number;
  professionalField: number;
  experience: number;
  availability: number;
  skills: number;
  languageTimezoneStyle: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  targetRole: 0.3,
  professionalField: 0.2,
  experience: 0.15,
  availability: 0.15,
  skills: 0.1,
  languageTimezoneStyle: 0.1,
};

/** Sub-weights inside the combined "language/timezone/connection-style" bucket. */
export interface StyleSubWeights {
  language: number;
  timezone: number;
  style: number;
}

export const DEFAULT_STYLE_SUB_WEIGHTS: StyleSubWeights = {
  language: 0.4,
  timezone: 0.3,
  style: 0.3,
};

/** Months beyond which experience proximity has fully decayed to 0. */
const EXPERIENCE_WINDOW_MONTHS = 60;

export interface AvailabilitySlot {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface ScoringProfile {
  targetRoleIds: string[];
  professionalFieldId: string | null;
  experienceMonths: number;
  tagIds: string[];
  languageIds: string[];
  timezone: string;
  connectionFormat: "ONE_ON_ONE" | "GROUP" | "BOTH";
  connectionCadence: "ONE_TIME" | "RECURRING" | "BOTH";
  connectionMode: "ONLINE" | "IN_PERSON" | "BOTH";
  availability: AvailabilitySlot[];
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersectionSize = [...setA].filter((x) => setB.has(x)).length;
  const unionSize = new Set([...setA, ...setB]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function experienceProximityScore(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return clamp01(1 - diff / EXPERIENCE_WINDOW_MONTHS);
}

function slotsOverlap(a: AvailabilitySlot, b: AvailabilitySlot): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/**
 * Fraction of the subject's availability slots that overlap at least one of
 * the candidate's. Cross-timezone comparisons return a neutral 0.5 (same
 * "cannot determine" stance as the privacy engine, not a penalty).
 */
function availabilityOverlapScore(
  subjectTimezone: string,
  subjectSlots: AvailabilitySlot[],
  candidateTimezone: string,
  candidateSlots: AvailabilitySlot[],
): number {
  if (subjectSlots.length === 0 || candidateSlots.length === 0) return 0.5;
  if (subjectTimezone !== candidateTimezone) return 0.5;
  const overlapping = subjectSlots.filter((s) => candidateSlots.some((c) => slotsOverlap(s, c)));
  return overlapping.length / subjectSlots.length;
}

function threeWayCompatible<T extends string>(a: T | "BOTH", b: T | "BOTH"): boolean {
  if (a === "BOTH" || b === "BOTH") return true;
  return a === b;
}

function styleScore(subject: ScoringProfile, candidate: ScoringProfile, weights: StyleSubWeights): number {
  const languageScore = jaccard(subject.languageIds, candidate.languageIds) > 0 ? 1 : 0;
  const timezoneScore = subject.timezone === candidate.timezone ? 1 : 0;
  const styleCompatible =
    threeWayCompatible(subject.connectionCadence, candidate.connectionCadence) &&
    threeWayCompatible(subject.connectionMode, candidate.connectionMode)
      ? 1
      : 0;

  const total = weights.language + weights.timezone + weights.style;
  if (total === 0) return 0;
  return (
    (languageScore * weights.language + timezoneScore * weights.timezone + styleCompatible * weights.style) / total
  );
}

export interface ScoreBreakdown {
  targetRoleScore: number;
  fieldScore: number;
  experienceScore: number;
  availabilityScore: number;
  skillsScore: number;
  languageScore: number; // the combined language/timezone/style bucket
  totalScore: number;
}

export function computeScoreBreakdown(
  subject: ScoringProfile,
  candidate: ScoringProfile,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  styleWeights: StyleSubWeights = DEFAULT_STYLE_SUB_WEIGHTS,
): ScoreBreakdown {
  const targetRoleScore = jaccard(subject.targetRoleIds, candidate.targetRoleIds);
  const fieldScore =
    subject.professionalFieldId && subject.professionalFieldId === candidate.professionalFieldId ? 1 : 0;
  const experienceScore = experienceProximityScore(subject.experienceMonths, candidate.experienceMonths);
  const availabilityScore = availabilityOverlapScore(
    subject.timezone,
    subject.availability,
    candidate.timezone,
    candidate.availability,
  );
  const skillsScore = jaccard(subject.tagIds, candidate.tagIds);
  const languageScore = styleScore(subject, candidate, styleWeights);

  const totalScore =
    targetRoleScore * weights.targetRole +
    fieldScore * weights.professionalField +
    experienceScore * weights.experience +
    availabilityScore * weights.availability +
    skillsScore * weights.skills +
    languageScore * weights.languageTimezoneStyle;

  return { targetRoleScore, fieldScore, experienceScore, availabilityScore, skillsScore, languageScore, totalScore };
}

export interface SafeReason {
  code: string;
  labelHe: string;
}

const REASON_THRESHOLD = 0.5;
const MAX_REASONS = 3;

/**
 * Safe, human-readable reasons a match may be relevant — derived only from
 * which sub-scores are strong, never the raw numbers or any privacy-gate
 * internals. This is what a user is allowed to see; the full breakdown
 * (ScoreBreakdown) is for admin/test use only.
 */
export function generateSafeReasons(breakdown: ScoreBreakdown): SafeReason[] {
  const candidates: SafeReason[] = [];
  if (breakdown.targetRoleScore >= REASON_THRESHOLD) {
    candidates.push({ code: "target_role", labelHe: "מחפש/ת תפקיד דומה לשלך" });
  }
  if (breakdown.fieldScore >= REASON_THRESHOLD) {
    candidates.push({ code: "field", labelHe: "אותו תחום מקצועי" });
  }
  if (breakdown.experienceScore >= REASON_THRESHOLD) {
    candidates.push({ code: "experience", labelHe: "רמת ניסיון דומה" });
  }
  if (breakdown.availabilityScore >= REASON_THRESHOLD) {
    candidates.push({ code: "availability", labelHe: "זמינות חופפת" });
  }
  if (breakdown.skillsScore >= REASON_THRESHOLD) {
    candidates.push({ code: "skills", labelHe: "כישורים ותחומים משותפים" });
  }
  if (breakdown.languageScore >= REASON_THRESHOLD) {
    candidates.push({ code: "style", labelHe: "שפה, אזור זמן וסגנון חיבור תואמים" });
  }

  return candidates
    .sort((a, b) => scoreFor(breakdown, b.code) - scoreFor(breakdown, a.code))
    .slice(0, MAX_REASONS);
}

function scoreFor(breakdown: ScoreBreakdown, code: string): number {
  switch (code) {
    case "target_role":
      return breakdown.targetRoleScore;
    case "field":
      return breakdown.fieldScore;
    case "experience":
      return breakdown.experienceScore;
    case "availability":
      return breakdown.availabilityScore;
    case "skills":
      return breakdown.skillsScore;
    case "style":
      return breakdown.languageScore;
    default:
      return 0;
  }
}
