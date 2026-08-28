// Pure, framework/DB-free resume-text parsing (spec §5.3). No layout or
// language model is used — this is a best-effort heuristic scan over plain
// text, intentionally named "deterministic" to contrast with an optional
// future AI parser (see ParserSource in the schema). Its output is always a
// *draft*: nothing here is ever applied to a profile without the user
// reviewing and confirming (and freely editing) every field first, so a
// missed or wrong guess degrades gracefully into "the user fills it in
// manually" rather than corrupting real profile data.

export interface CandidatePosition {
  companyRaw: string;
  title: string;
  startYear: number;
  startMonth: number;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
}

export interface KnownLabel {
  id: string;
  labelHe: string;
  labelEn: string;
}

export interface ExtractedResumeText {
  positions: CandidatePosition[];
  currentRoleTitleGuess: string | null;
  matchedTagIds: string[];
  matchedLanguageIds: string[];
}

const MAX_POSITIONS = 8;
const MAX_MATCHED_TAGS = 15;
const MAX_MATCHED_LANGUAGES = 6;

const MONTH_YEAR = String.raw`\d{1,2}[./]\d{4}`;
const YEAR_ONLY = String.raw`\d{4}`;
const PRESENT_WORD = String.raw`הווה|כיום|present|current|now`;
const DATE_TOKEN = `(?:${MONTH_YEAR}|${YEAR_ONLY})`;

const RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*[-–—]\\s*(${DATE_TOKEN}|${PRESENT_WORD})`, "i");

const SEPARATORS = [" – ", " — ", " - ", " | ", " @ ", " אצל ", " ב-"];

function parseDateToken(token: string): { year: number; month: number } {
  const monthYear = token.match(/^(\d{1,2})[./](\d{4})$/);
  if (monthYear) return { month: Math.min(12, Math.max(1, Number(monthYear[1]))), year: Number(monthYear[2]) };
  return { month: 1, year: Number(token) };
}

function stripRangeFromLine(line: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return (line.slice(0, start) + line.slice(start + match[0].length)).trim();
}

function splitCompanyAndTitle(contentLine: string): { companyRaw: string; title: string } {
  for (const sep of SEPARATORS) {
    const idx = contentLine.indexOf(sep);
    if (idx > 0) {
      const left = contentLine.slice(0, idx).trim();
      const right = contentLine.slice(idx + sep.length).trim();
      if (left && right) return { companyRaw: left, title: right };
    }
  }
  return { companyRaw: contentLine, title: "" };
}

/** Extracts date-ranged position candidates by scanning each line for a recognizable date range, then using the surrounding non-empty lines as the company/title context. */
function extractPositions(lines: string[]): CandidatePosition[] {
  const candidates: CandidatePosition[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(RANGE_RE);
    if (!match) continue;

    const remainder = stripRangeFromLine(line, match);
    const contextLine = remainder.length > 2 ? remainder : (lines[i - 1] ?? lines[i + 1] ?? "");
    if (!contextLine) continue;

    const { companyRaw, title } = splitCompanyAndTitle(contextLine);
    if (!companyRaw) continue;

    const start = parseDateToken(match[1]);
    const isPresent = new RegExp(`^(?:${PRESENT_WORD})$`, "i").test(match[2]);
    const end = isPresent ? null : parseDateToken(match[2]);

    candidates.push({
      companyRaw,
      title,
      startYear: start.year,
      startMonth: start.month,
      endYear: end?.year ?? null,
      endMonth: end?.month ?? null,
      isCurrent: isPresent,
    });

    if (candidates.length >= MAX_POSITIONS) break;
  }

  candidates.sort((a, b) => b.startYear - a.startYear || b.startMonth - a.startMonth);

  // If nothing was explicitly marked "present", leave isCurrent unset for
  // all of them — guessing wrong here would silently misrepresent someone's
  // employer, which the privacy engine treats as security-sensitive.
  return candidates;
}

function matchLabels(text: string, labels: KnownLabel[], max: number): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const label of labels) {
    if (lower.includes(label.labelHe.toLowerCase()) || lower.includes(label.labelEn.toLowerCase())) {
      matched.push(label.id);
      if (matched.length >= max) break;
    }
  }
  return matched;
}

export function parseResumeText(text: string, knownTags: KnownLabel[], knownLanguages: KnownLabel[]): ExtractedResumeText {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const positions = extractPositions(lines);
  const current = positions.find((p) => p.isCurrent) ?? null;

  return {
    positions,
    currentRoleTitleGuess: current?.title || null,
    matchedTagIds: matchLabels(text, knownTags, MAX_MATCHED_TAGS),
    matchedLanguageIds: matchLabels(text, knownLanguages, MAX_MATCHED_LANGUAGES),
  };
}
