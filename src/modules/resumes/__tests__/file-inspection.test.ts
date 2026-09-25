import { describe, expect, it } from "vitest";
import { deflateRawSync, deflateSync } from "node:zlib";
import { inspectUpload } from "@/modules/resumes/file-inspection";
import { buildMinimalPdf } from "@/modules/resumes/__tests__/pdf-fixture";

/** Minimal ZIP writer (deflated entries, CRC left at 0 — the inspector doesn't verify it). */
function buildZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, "utf8");
    const raw = Buffer.from(content, "utf8");
    const data = deflateRawSync(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + data.length;
  }
  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, eocd]);
}

const CONTENT_TYPES_DOCX =
  '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';

function docx(extra: Record<string, string> = {}): Buffer {
  return buildZip({
    "[Content_Types].xml": CONTENT_TYPES_DOCX,
    "_rels/.rels": '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": "<w:document><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>",
    ...extra,
  });
}

function pdfWithObject(obj: string, { compressed = false } = {}): Buffer {
  const base = buildMinimalPdf("Senior engineer").toString("latin1");
  if (!compressed) return Buffer.from(base.replace("%PDF-1.4\n", `%PDF-1.4\n9 0 obj${obj}endobj\n`), "latin1");
  const body = deflateSync(Buffer.from(obj, "latin1"));
  return Buffer.concat([
    Buffer.from(`%PDF-1.5\n9 0 obj<</Type/ObjStm/Filter/FlateDecode/Length ${body.length}>>stream\n`, "latin1"),
    body,
    Buffer.from("\nendstream\nendobj\n", "latin1"),
    Buffer.from(base.slice("%PDF-1.4\n".length), "latin1"),
  ]);
}

describe("inspectUpload", () => {
  it("rejects empty and unrecognized files", () => {
    expect(inspectUpload(Buffer.alloc(0)).clean).toBe(false);
    expect(inspectUpload(Buffer.from("MZ\x90\x00 an exe")).clean).toBe(false);
    expect(inspectUpload(Buffer.from("<html><script>")).clean).toBe(false);
  });

  it("accepts image magic bytes", () => {
    expect(inspectUpload(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])).clean).toBe(true);
    expect(inspectUpload(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])).clean).toBe(true);
    expect(inspectUpload(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")])).clean).toBe(true);
  });

  describe("PDF", () => {
    it("accepts a plain PDF", () => {
      expect(inspectUpload(buildMinimalPdf("Senior engineer")).clean).toBe(true);
    });

    it("does not flag page text that merely looks like a name (React/JS, /Launch)", () => {
      expect(inspectUpload(buildMinimalPdf("React/JS developer; led /Launch of /JavaScript tooling")).clean).toBe(true);
    });

    it("rejects JavaScript actions", () => {
      expect(inspectUpload(pdfWithObject("<</S/JavaScript/JS(app.alert(1))>>")).clean).toBe(false);
    });

    it("rejects hex-escaped names (/J#61vaScript)", () => {
      expect(inspectUpload(pdfWithObject("<</S/J#61vaScript/J#53(x)>>")).clean).toBe(false);
    });

    it("rejects launch actions, embedded files, and XFA forms", () => {
      expect(inspectUpload(pdfWithObject("<</S/Launch/F(cmd.exe)>>")).clean).toBe(false);
      expect(inspectUpload(pdfWithObject("<</Type/EmbeddedFile>>")).clean).toBe(false);
      expect(inspectUpload(pdfWithObject("<</AcroForm<</XFA 10 0 R>>>>")).clean).toBe(false);
    });

    it("finds active content hidden inside a compressed object stream", () => {
      expect(inspectUpload(pdfWithObject("<</S/JavaScript/JS 12 0 R>>", { compressed: true })).clean).toBe(false);
      expect(inspectUpload(pdfWithObject("<</Type/Font>>", { compressed: true })).clean).toBe(true);
    });

    it("accepts an encrypted PDF whose dictionaries are all plaintext, rejects one hiding them in object streams", () => {
      expect(inspectUpload(pdfWithObject("<</Encrypt 10 0 R>>")).clean).toBe(true);
      expect(inspectUpload(pdfWithObject("<</Encrypt 10 0 R/Type/ObjStm>>")).clean).toBe(false);
    });

    it("rejects a decompression bomb", () => {
      const bomb = deflateSync(Buffer.alloc(60 * 1024 * 1024));
      const pdf = Buffer.concat([
        Buffer.from(`%PDF-1.5\n1 0 obj<</Filter/FlateDecode/Length ${bomb.length}>>stream\n`, "latin1"),
        bomb,
        Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
      ]);
      expect(inspectUpload(pdf)).toEqual({ clean: false, reason: "decompression limit exceeded" });
    });
  });

  describe("DOCX", () => {
    it("accepts a plain document, including external hyperlinks", () => {
      const rels =
        '<Relationships><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://linkedin.com/in/x" TargetMode="External"/></Relationships>';
      expect(inspectUpload(docx({ "word/_rels/document.xml.rels": rels })).clean).toBe(true);
    });

    it("rejects a zip that isn't a Word document", () => {
      expect(inspectUpload(buildZip({ "evil.exe": "MZ" })).clean).toBe(false);
    });

    it("rejects macros, ActiveX, and embedded OLE objects", () => {
      expect(inspectUpload(docx({ "word/vbaProject.bin": "x" })).clean).toBe(false);
      expect(inspectUpload(docx({ "word/activeX/activeX1.xml": "<x/>" })).clean).toBe(false);
      expect(inspectUpload(docx({ "word/embeddings/oleObject1.bin": "x" })).clean).toBe(false);
    });

    it("rejects a macro-enabled content type", () => {
      const doc = buildZip({
        "[Content_Types].xml": '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>',
        "word/document.xml": "<w:document/>",
      });
      expect(inspectUpload(doc).clean).toBe(false);
    });

    it("rejects a remote template (template injection)", () => {
      const rels =
        '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="http://evil.example/t.dotm" TargetMode="External"/></Relationships>';
      expect(inspectUpload(docx({ "word/_rels/settings.xml.rels": rels })).clean).toBe(false);
    });

    it("rejects a malformed archive", () => {
      expect(inspectUpload(Buffer.from("PK\x03\x04 truncated")).clean).toBe(false);
    });
  });
});
