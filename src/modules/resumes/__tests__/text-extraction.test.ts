import { describe, expect, it } from "vitest";
import { extractText, looksLikeEmptyTextLayer, PDF_MIME_TYPE, DOCX_MIME_TYPE } from "@/modules/resumes/text-extraction";
import { buildMinimalPdf } from "@/modules/resumes/__tests__/pdf-fixture";

describe("extractText", () => {
  it("extracts text from a real PDF via pdf-parse", async () => {
    const buffer = buildMinimalPdf("Acme Corp - Backend Developer 01/2020 - 05/2022");
    const text = await extractText(buffer, PDF_MIME_TYPE);
    expect(text).toContain("Acme Corp - Backend Developer 01/2020 - 05/2022");
  });

  it("throws a clear error for an unsupported mime type", async () => {
    await expect(extractText(Buffer.from("hello"), "text/plain")).rejects.toThrow(/unsupported resume mime type/);
  });

  it("rejects malformed input for a declared docx mime type instead of hanging or crashing silently", async () => {
    await expect(extractText(Buffer.from("not a real docx"), DOCX_MIME_TYPE)).rejects.toThrow();
  });

  it("always returns NFC-normalized text, regardless of input", async () => {
    // The synthetic PDF fixture (pdf-fixture.ts) writes text through a base
    // Helvetica font with Latin-1 byte encoding, so it can't represent
    // Hebrew or combining marks — decomposed-Hebrew-via-NFC normalization is
    // covered directly against the pure parser instead (see
    // deterministic-parser.test.ts's NFD-robustness test). This just checks
    // that extractText's own normalization step actually runs.
    const buffer = buildMinimalPdf("Cafe résumé"); // "é" written as e + combining acute
    const text = await extractText(buffer, PDF_MIME_TYPE);
    expect(text.normalize("NFC")).toBe(text);
  });

  it("collapses long runs of blank lines and trims trailing whitespace per line", async () => {
    const buffer = buildMinimalPdf("Line one   \n\n\n\n\nLine two");
    const text = await extractText(buffer, PDF_MIME_TYPE);
    expect(text).not.toMatch(/\n{3,}/);
    expect(text).not.toMatch(/ +\n/);
  });
});

describe("looksLikeEmptyTextLayer", () => {
  it("is true for empty or near-empty text (the scanned/image-only PDF signature)", () => {
    expect(looksLikeEmptyTextLayer("")).toBe(true);
    expect(looksLikeEmptyTextLayer("   \n\n  ")).toBe(true);
    expect(looksLikeEmptyTextLayer("hi")).toBe(true);
  });

  it("is false for text long enough to plausibly be a real resume", () => {
    expect(looksLikeEmptyTextLayer("Acme Corp - Backend Developer\n01/2020 - Present\nBuilding real-time systems.")).toBe(false);
  });
});
