import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Structural "active content" inspection for user uploads — pure, no DB,
 * no framework. This is NOT signature-based antivirus: it doesn't know about
 * specific malware families. It rejects the file *shapes* that carry
 * executable payloads in documents — PDF JavaScript/launch actions/embedded
 * files, DOCX macros/ActiveX/OLE objects/remote templates — plus anything
 * whose magic bytes aren't one of the formats we accept. Résumés and
 * profile photos have no legitimate reason to contain any of those.
 */

export type InspectionResult = { clean: true } | { clean: false; reason: string };

/** Per-file ceiling on decompressed bytes we're willing to produce — a
 * 5MB upload inflating past this is a decompression bomb, not a résumé. */
const MAX_INFLATED_BYTES = 50 * 1024 * 1024;

const ok: InspectionResult = { clean: true };
const reject = (reason: string): InspectionResult => ({ clean: false, reason });

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b);
}

export function inspectUpload(buffer: Buffer): InspectionResult {
  if (buffer.length === 0) return reject("empty file");
  // "%PDF-" may legally sit anywhere in the first 1KB, but real résumé
  // exporters always put it first; requiring it at 0 blocks polyglots.
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return inspectPdf(buffer);
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) return inspectDocx(buffer);
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return ok; // JPEG
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ok; // PNG
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString("latin1") === "WEBP") return ok;
  return reject("unrecognized file format");
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Name tokens that make a PDF do something beyond rendering. */
const PDF_DANGEROUS_NAMES = [
  "JavaScript",
  "JS",
  "Launch",
  "EmbeddedFile",
  "EmbeddedFiles",
  "RichMedia",
  "XFA",
  "SubmitForm",
  "ImportData",
  "GoToE",
];

// A PDF name ends at whitespace or a delimiter; this stops "/JS" matching "/JSomething".
const PDF_DANGEROUS_RE = new RegExp(`/(?:${PDF_DANGEROUS_NAMES.join("|")})(?=[\\s/<>\\[\\]()%{}]|$)`);

/** "/J#61vaScript" is a legal spelling of "/JavaScript" — decode #xx escapes in names first. */
function normalizePdfNames(text: string): string {
  return text.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Drops (literal strings) so page text like "React/JS" can't look like a
 * /JS name. Action dictionaries keep their names outside strings, so real
 * active content is still visible after stripping.
 */
function stripPdfStrings(text: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (depth > 0) {
      if (ch === "\\") i++;
      else if (ch === "(") depth++;
      else if (ch === ")") depth--;
      continue;
    }
    if (ch === "(") depth = 1;
    else out += ch;
  }
  return out;
}

function inspectPdf(buffer: Buffer): InspectionResult {
  const raw = buffer.toString("latin1");

  // Stream bodies are checked separately (inflated); blanking them in the raw
  // text keeps binary image/font bytes from producing accidental matches.
  let structure = "";
  const texts: string[] = [];
  let lastEnd = 0;
  let inflatedTotal = 0;
  const streamRe = /(?<!end)stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end === -1) break;
    streamRe.lastIndex = end + "endstream".length;
    structure += raw.slice(lastEnd, start);
    lastEnd = end;
    const budget = MAX_INFLATED_BYTES - inflatedTotal;
    if (budget <= 0) return reject("decompression limit exceeded");
    try {
      // Only Flate streams inflate; anything else (DCT images, etc.) throws and is skipped.
      const inflated = inflateSync(buffer.subarray(start, end), { maxOutputLength: budget });
      inflatedTotal += inflated.length;
      texts.push(inflated.toString("latin1"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") return reject("decompression limit exceeded");
    }
  }

  structure += raw.slice(lastEnd);
  const normalizedStructure = normalizePdfNames(stripPdfStrings(structure));
  // Encryption covers strings and streams, never plain dictionaries — so a
  // common permissions-only encrypted PDF is still fully visible to us,
  // *unless* it packs dictionaries into (encrypted) object streams.
  const encrypted = /\/Encrypt(?=[\s/<>\[\]])/.test(normalizedStructure);
  if (encrypted && /\/ObjStm(?=[\s/<>\[\]])/.test(normalizedStructure)) return reject("encrypted PDF with object streams");
  texts.push(structure);

  for (const text of texts) {
    const found = PDF_DANGEROUS_RE.exec(normalizePdfNames(stripPdfStrings(text)));
    if (found) return reject(`PDF active content (${found[0]})`);
  }
  return ok;
}

// ---------------------------------------------------------------------------
// DOCX (a ZIP container)
// ---------------------------------------------------------------------------

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

/** Reads the ZIP central directory. Returns null if the archive is malformed. */
function readZipEntries(buffer: Buffer): ZipEntry[] | null {
  // End-of-central-directory record: last 22 bytes + up to 64KB comment.
  const searchFrom = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= searchFrom; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) return null;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries.push({
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
      name: buffer.toString("utf8", offset + 46, offset + 46 + nameLength),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): string | null {
  const header = entry.localHeaderOffset;
  if (header + 30 > buffer.length || buffer.readUInt32LE(header) !== 0x04034b50) return null;
  const dataStart = header + 30 + buffer.readUInt16LE(header + 26) + buffer.readUInt16LE(header + 28);
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return data.toString("utf8");
  if (entry.method === 8) return inflateRawSync(data, { maxOutputLength: MAX_INFLATED_BYTES }).toString("utf8");
  return null;
}

/** Parts whose mere presence means macros, ActiveX controls, or embedded OLE/binary objects. */
const DOCX_DANGEROUS_PART_RE = /(^|\/)(vbaProject\.bin|vbaData\.xml)$|(^|\/)(activeX|embeddings)\//i;

/** Relationship types that, pointed at an external URL, fetch and run remote content ("remote template injection"). */
const DOCX_DANGEROUS_EXTERNAL_REL_RE = /\/(attachedTemplate|oleObject|subDocument|frame)$/;

function inspectDocx(buffer: Buffer): InspectionResult {
  const entries = readZipEntries(buffer);
  if (!entries) return reject("malformed archive");

  const totalUncompressed = entries.reduce((sum, e) => sum + e.uncompressedSize, 0);
  if (totalUncompressed > MAX_INFLATED_BYTES) return reject("decompression limit exceeded");

  const names = new Set(entries.map((e) => e.name));
  if (!names.has("[Content_Types].xml") || !names.has("word/document.xml")) return reject("not a Word document");

  for (const entry of entries) {
    if (DOCX_DANGEROUS_PART_RE.test(entry.name)) return reject(`DOCX active content (${entry.name})`);
  }

  try {
    for (const entry of entries) {
      const isContentTypes = entry.name === "[Content_Types].xml";
      if (!isContentTypes && !entry.name.endsWith(".rels")) continue;
      const xml = readZipEntry(buffer, entry);
      if (xml === null) return reject("malformed archive");

      if (isContentTypes) {
        if (/macroEnabled|vbaProject|activeX|oleObject/i.test(xml)) return reject("DOCX active content (content types)");
        continue;
      }

      for (const rel of xml.match(/<Relationship\b[^>]*>/g) ?? []) {
        const type = /\bType="([^"]*)"/.exec(rel)?.[1] ?? "";
        const external = /\bTargetMode="External"/.test(rel);
        if (external && DOCX_DANGEROUS_EXTERNAL_REL_RE.test(type)) return reject("DOCX remote template or object");
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") return reject("decompression limit exceeded");
    return reject("malformed archive");
  }

  return ok;
}
