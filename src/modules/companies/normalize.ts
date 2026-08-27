// Pure string-normalization helpers for company-name matching. No DB, no
// framework imports — kept separate from service.ts so the matching logic
// itself is directly unit-testable.

const LEGAL_SUFFIXES = [
  // Hebrew
  'בע"מ',
  "בעמ",
  "בע''מ",
  // English
  "ltd",
  "llc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "gmbh",
  "plc",
];

/**
 * Normalizes a company name for comparison: lowercases, strips punctuation,
 * collapses whitespace, and drops common legal-entity suffixes (so "Google
 * Israel Ltd." and "google israel" compare equal). Not a canonicalization —
 * two normalized names matching is a strong signal, not a guarantee they're
 * the same company (see findOrCreateCompanyByName for how that's handled).
 */
export function normalizeCompanyName(raw: string): string {
  let value = raw
    .trim()
    .toLowerCase()
    .replace(/["'.,()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const suffix of LEGAL_SUFFIXES) {
    const re = new RegExp(`(^|\\s)${suffix}(\\s|$)`, "gi");
    value = value.replace(re, " ").trim().replace(/\s+/g, " ");
  }

  return value;
}

/** Levenshtein edit distance, used as a fallback fuzzy-match signal for typos. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let previous = Array.from({ length: n + 1 }, (_, i) => i);
  let current = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    current[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }

  return previous[n];
}

export type MatchQuality = "exact" | "close" | "partial" | "none";

/** How well `query` matches `candidate`, both already normalized. */
export function matchQuality(query: string, candidate: string): MatchQuality {
  if (!query || !candidate) return "none";
  if (query === candidate) return "exact";
  if (candidate.includes(query) || query.includes(candidate)) return "partial";
  const distance = editDistance(query, candidate);
  const threshold = Math.max(1, Math.floor(Math.min(query.length, candidate.length) * 0.2));
  if (distance <= threshold) return "close";
  return "none";
}
