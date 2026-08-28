/**
 * Builds a minimal, structurally valid single-page PDF containing the
 * given text — lets the resume-upload e2e spec exercise the real
 * pdf-parse extraction path without checking a binary fixture file into
 * the repo. Mirrors src/modules/resumes/__tests__/pdf-fixture.ts; kept as
 * a separate copy here since e2e specs don't share the app's `@/` path
 * resolution.
 */
export function buildMinimalPdf(lines: string[]): Buffer {
  const escape = (s: string) => s.replace(/([()\\])/g, "\\$1");
  const objects: string[] = [];
  objects[1] = "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n";
  objects[2] = "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n";
  objects[3] =
    "3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 500 300]/Contents 5 0 R>>endobj\n";
  objects[4] = "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n";

  let ty = 260;
  let streamBody = "";
  for (const line of lines) {
    streamBody += `BT /F1 11 Tf 10 ${ty} Td (${escape(line)}) Tj ET\n`;
    ty -= 16;
  }
  objects[5] = `5 0 obj<</Length ${streamBody.length}>>stream\n${streamBody}endstream\nendobj\n`;

  const header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [0];
  let pos = header.length;
  for (let i = 1; i <= 5; i++) {
    offsets[i] = pos;
    body += objects[i];
    pos += objects[i].length;
  }
  const xrefStart = pos;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(header + body + xref + trailer, "latin1");
}
