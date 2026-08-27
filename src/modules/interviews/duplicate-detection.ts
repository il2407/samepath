// Pure heuristics for the interview library: near-duplicate question
// detection and a lightweight prohibited-content scan. Both are
// intentionally simple, documented MVP heuristics — not ML — per the
// spec's "avoid opaque ML for the MVP" guidance applied consistently.

export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function wordSet(text: string): Set<string> {
  return new Set(normalizeQuestionText(text).split(" ").filter(Boolean));
}

/** Jaccard similarity of the two questions' word sets — robust to light paraphrasing. */
export function wordSetSimilarity(a: string, b: string): number {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersectionSize = [...setA].filter((w) => setB.has(w)).length;
  const unionSize = new Set([...setA, ...setB]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

const DUPLICATE_SIMILARITY_THRESHOLD = 0.7;

export function isLikelyDuplicateQuestion(a: string, b: string): boolean {
  return wordSetSimilarity(a, b) >= DUPLICATE_SIMILARITY_THRESHOLD;
}

/** Every existing question that looks like a near-duplicate of `text`. */
export function findLikelyDuplicates(text: string, existing: string[]): string[] {
  return existing.filter((candidate) => isLikelyDuplicateQuestion(text, candidate));
}

export interface ContentScanResult {
  flagged: boolean;
  reasons: ("possible_email" | "possible_phone_number" | "possible_url")[];
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_PATTERN = /(?:\+?\d[\d\-\s]{7,}\d)/;
const URL_PATTERN = /\bhttps?:\/\/\S+/i;

/**
 * Flags obvious personal-data/contact-detail patterns for moderation review.
 * This is a coarse first pass, not a guarantee of anonymity — moderators
 * still review every submission.
 */
export function scanForProhibitedContent(text: string): ContentScanResult {
  const reasons: ContentScanResult["reasons"] = [];
  if (EMAIL_PATTERN.test(text)) reasons.push("possible_email");
  if (PHONE_PATTERN.test(text)) reasons.push("possible_phone_number");
  if (URL_PATTERN.test(text)) reasons.push("possible_url");
  return { flagged: reasons.length > 0, reasons };
}
