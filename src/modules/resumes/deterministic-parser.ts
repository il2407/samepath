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
  /** Target-role labels found verbatim in the text (same matching approach as skills/languages — an exact label substring, never a guess). */
  matchedTargetRoleIds: string[];
  /** At most one — the region field in the profile form is a single-select, so unlike skills/languages/roles there is no "list of matches" to return. Null, never a guessed default, when no known region label appears in the text. */
  matchedRegionId: string | null;
  /** A single-sentence draft for the profile's "short intro" field, heuristically lifted from a detected summary/about section. Null (never a fabricated placeholder) when no such section is found or its body is too sparse to be useful — see extractShortIntroGuess. */
  shortIntroGuess: string | null;
}

const MAX_POSITIONS = 8;
const MAX_MATCHED_TAGS = 15;
const MAX_MATCHED_LANGUAGES = 6;
const MAX_MATCHED_TARGET_ROLES = 4;
const MIN_SHORT_INTRO_LENGTH = 15;

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

/** Same matching rule as matchLabels, but for a single-select field (region): returns the first match, or null when none of the known labels appear in the text — never a guessed default. */
function matchFirstLabel(text: string, labels: KnownLabel[]): string | null {
  return matchLabels(text, labels, 1)[0] ?? null;
}

// Headings that plausibly introduce a self-written summary/about section, in
// Hebrew and English. Deliberately narrow (exact heading line, not "contains
// the word somewhere") to keep the false-positive rate low — grabbing the
// wrong paragraph and presenting it as a suggested "about you" draft would
// violate the no-hallucinated-content rule just as much as inventing text
// outright.
const SUMMARY_HEADING_RE = /^(תקציר|תמצית|אודות|על עצמי|פרופיל אישי|summary|about( me)?|profile|objective)\s*[:\-–]?\s*$/i;

/**
 * Heuristically drafts a one-sentence "short intro" suggestion from a
 * detected summary/about heading's very next line — never from arbitrary
 * prose elsewhere in the resume, to avoid quoting something out of context
 * and presenting it as a self-description. Returns null (not an empty
 * string, and never a fabricated sentence) whenever no such heading is
 * found, the heading has no following line, or that line is too short to
 * plausibly be real content (e.g. immediately followed by another section
 * heading with nothing in between) — this is a draft the user can freely
 * edit or clear in ResumeDraftReview, so understating (null) is always the
 * safer failure mode than overstating (a wrong-looking confident guess).
 */
function extractShortIntroGuess(lines: string[]): string | null {
  const headingIndex = lines.findIndex((l) => SUMMARY_HEADING_RE.test(l));
  if (headingIndex === -1 || headingIndex + 1 >= lines.length) return null;

  const candidate = lines[headingIndex + 1];
  if (!candidate || candidate.length < MIN_SHORT_INTRO_LENGTH) return null;

  // Prefer the first full sentence within the line; otherwise fall back to
  // the whole line capped at the profile form's 400-character shortIntro limit.
  const sentenceMatch = candidate.match(/^(.{15,400}?[.!?])(?:\s|$)/);
  const guess = (sentenceMatch ? sentenceMatch[1] : candidate.slice(0, 400)).trim();
  return guess || null;
}

export function parseResumeText(
  text: string,
  knownTags: KnownLabel[],
  knownLanguages: KnownLabel[],
  knownTargetRoles: KnownLabel[] = [],
  knownRegions: KnownLabel[] = [],
): ExtractedResumeText {
  // NFC-normalize first: some PDF/DOCX generators emit Hebrew as a base
  // letter followed by separate combining marks (decomposed form), which
  // renders identically but fails a naive substring label match against a
  // precomposed label from the DB. This is pure/cheap and safe to apply
  // regardless of caller, so callers (text-extraction.ts) don't have to
  // remember to do it first.
  const normalized = text.normalize("NFC");

  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const positions = extractPositions(lines);
  const current = positions.find((p) => p.isCurrent) ?? null;

  return {
    positions,
    currentRoleTitleGuess: current?.title || null,
    matchedTagIds: matchLabels(normalized, knownTags, MAX_MATCHED_TAGS),
    matchedLanguageIds: matchLabels(normalized, knownLanguages, MAX_MATCHED_LANGUAGES),
    matchedTargetRoleIds: matchLabels(normalized, knownTargetRoles, MAX_MATCHED_TARGET_ROLES),
    matchedRegionId: matchFirstLabel(normalized, knownRegions),
    shortIntroGuess: extractShortIntroGuess(lines),
  };
}
