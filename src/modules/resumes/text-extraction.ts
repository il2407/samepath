import "server-only";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Below this many non-whitespace characters, treat extraction as having
// found essentially nothing. This is the practical signature of a
// scanned/image-only PDF (a photo or flatbed scan of a paper resume dropped
// into a PDF wrapper) — pdf-parse/pdfjs can only read an actual text layer,
// and a scanned page has none at all, so it returns empty or near-empty
// text rather than throwing. See docs/resume-extraction-approach.md for the
// full OCR evaluation (why this codebase doesn't add an OCR dependency to
// handle that case, at least for now).
const MIN_MEANINGFUL_TEXT_LENGTH = 40;

/**
 * True when extracted text is too sparse to plausibly represent a real
 * text-based resume. Exported so callers (resumes/service.ts) can surface a
 * specific, useful Hebrew message ("this looks like a scanned file") instead
 * of a generic "extraction failed" — distinguishing "we found nothing to
 * extract because there's no text here" from "something in the extraction
 * pipeline broke" is the whole point.
 */
export function looksLikeEmptyTextLayer(text: string): boolean {
  return text.trim().length < MIN_MEANINGFUL_TEXT_LENGTH;
}

/**
 * Cleans up encoding artifacts common to both extraction paths without
 * changing any actual content:
 * - NFC-normalizes Hebrew (and any other) text that some PDF/DOCX
 *   generators emit as a base letter + separate combining marks, which
 *   looks identical on screen but breaks exact-substring label matching in
 *   deterministic-parser.ts.
 * - Non-breaking spaces (a frequent copy-paste-from-Word artifact) become
 *   regular spaces so whitespace-sensitive matching behaves consistently.
 * - Stray control characters some PDF generators leave embedded in text
 *   runs are stripped (tab and newline are explicitly preserved).
 * - Runs of 3+ blank lines collapse to at most one, and trailing
 *   whitespace per line is trimmed — cosmetic only, makes the
 *   line-by-line heuristics in deterministic-parser.ts more reliable.
 */
function normalizeExtractedText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    // Stray control bytes some PDF generators leave embedded in text runs (tab \x09 and newline \x0A are intentionally excluded from this range).
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === PDF_MIME_TYPE) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return normalizeExtractedText(result.text);
    } finally {
      await parser.destroy();
    }
  }
  if (mimeType === DOCX_MIME_TYPE) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeExtractedText(result.value);
  }
  throw new Error(`unsupported resume mime type: ${mimeType}`);
}
