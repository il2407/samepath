import { describe, expect, it } from "vitest";
import { extractText, PDF_MIME_TYPE, DOCX_MIME_TYPE } from "@/modules/resumes/text-extraction";
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
});
