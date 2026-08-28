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
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toMonthString(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}
