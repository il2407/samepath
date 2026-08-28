/** Builds a minimal, structurally valid single-page PDF containing the given text, for exercising the real pdf-parse extraction path in tests without a binary fixture file. */
export function buildMinimalPdf(text: string): Buffer {
  const escaped = text.replace(/([()\\])/g, "\\$1");
  const objects: string[] = [];
  objects[1] = "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n";
  objects[2] = "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n";
  objects[3] =
    "3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 400 200]/Contents 5 0 R>>endobj\n";
  objects[4] = "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n";
  const stream = `BT /F1 12 Tf 10 150 Td (${escaped}) Tj ET`;
  objects[5] = `5 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream\nendobj\n`;

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
