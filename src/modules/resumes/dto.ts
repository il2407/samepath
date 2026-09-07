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
  matchedLanguageIds: string[];
  /** Target-role labels found verbatim in the resume text (see deterministic-parser.ts) — the profile form allows selecting more than one. */
  matchedTargetRoleIds: string[];
  /** Derived from the first entry of matchedTargetRoleIds (a target role always belongs to exactly one professional field) — null when no target role matched, never a guessed default field. */
  professionalFieldIdGuess: string | null;
  /** At most one match — the profile form's region field is a single-select. Null when no known region label appears in the text. */
  matchedRegionId: string | null;
  /** A heuristic one-sentence "short intro" draft (see deterministic-parser.ts's extractShortIntroGuess) — null, never a fabricated sentence, when no summary/about section was confidently found. */
  shortIntroGuess: string | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toMonthString(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}
