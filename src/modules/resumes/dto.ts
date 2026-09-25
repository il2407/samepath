// The shape persisted in ResumeExtractionDraft.extractedJson. Kept separate
// from the pure parser's output because positions here carry a resolved
// companyId (a DB lookup the pure parser can't do), and separate from the
// profiles module because this is resume-extraction's own storage concern,
// not a UI type.

export interface DraftPosition {
  companyId: string;
  companyName: string;
  companyRaw: string;
  title: string;
  startMonth: string;
  endMonth: string | null;
  isCurrent: boolean;
}

export interface StoredExtractedResumeData {
  positions: DraftPosition[];
  currentRoleTitleGuess: string | null;
  matchedTagIds: string[];
  /** Target-role labels found verbatim in the resume text (see deterministic-parser.ts) — the profile form allows selecting more than one. */
  matchedTargetRoleIds: string[];
  /** Derived from the first entry of matchedTargetRoleIds (a target role always belongs to exactly one professional field) — null when no target role matched, never a guessed default field. */
  professionalFieldIdGuess: string | null;
  /** At most one match — the profile form's region field is a single-select. Null when no known region label appears in the text. */
  matchedRegionId: string | null;
  /** A heuristic one-sentence "short intro" draft (see deterministic-parser.ts's extractShortIntroGuess) — null, never a fabricated sentence, when no summary/about section was confidently found. */
  shortIntroGuess: string | null;
  /** A freshly AI-composed (not extracted verbatim) alternative short-intro sentence, offered as a suggestion the user can choose to use instead of shortIntroGuess — only ever populated when the AI resume parser ran (RESUME_PARSER="ai", the default); always null under the deterministic parser, since composing new text isn't something it can do. */
  aiSummaryGuess: string | null;
  /** A best-effort full-name draft (see deterministic-parser.ts's extractFullNameGuess) — null when not confidently found. */
  fullNameGuess: string | null;
  /** A phone number found and validated in the resume text (see deterministic-parser.ts's extractPhoneGuess) — null when no candidate passes validation. */
  phoneGuess: string | null;
  /** A LinkedIn profile URL found in the resume text, normalized (see deterministic-parser.ts's extractLinkedInGuess) — null when none is found. */
  linkedInUrlGuess: string | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toMonthString(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}
