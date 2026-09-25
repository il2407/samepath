import "server-only";
import path from "node:path";
import { prisma } from "@/shared/db";
import { getStorage, generatePhotoStorageKey } from "@/shared/storage";
import { getMalwareScanner } from "@/modules/resumes/malware-scan";
import { logger } from "@/shared/logger";

const MAX_SIZE_BYTES = 3 * 1024 * 1024;

/** Extensions accepted for each sniffed image type — cross-checked against the filename so a
 *  renamed file (e.g. `payload.jpg` that's actually a PNG, or vice versa) is rejected even though
 *  its magic bytes are a real, allowed image format. */
const ALLOWED_EXTENSIONS_BY_MIME: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export interface UploadedPhotoFile {
  filename: string;
  /** The browser/client's reported content type — NEVER trusted for validation (see sniffImageMimeType below); kept only for parity with the resumes UploadedFile shape. */
  mimeType: string;
  buffer: Buffer;
}

export type UploadProfilePhotoResult = { ok: true } | { ok: false; error: string };

/**
 * Detects the real image format from its magic bytes instead of trusting the client-supplied MIME
 * type string. A browser's `file.type` is derived from the OS/browser's own guess (often just the
 * filename extension), and a raw multipart request can set the `Content-Type` field to anything —
 * neither is a safety guarantee. Returns null for anything that isn't one of the three formats this
 * app accepts, which also rejects non-image files masquerading as images (e.g. an HTML or script
 * file renamed to `photo.jpg` with a spoofed mimeType).
 */
function sniffImageMimeType(buffer: Buffer): string | null {
  // JPEG: starts with the SOI marker FF D8 FF.
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: fixed 8-byte signature.
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: RIFF container with a WEBP form type at byte 8.
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

/**
 * Validates a candidate profile photo and returns the format actually detected in its bytes (never
 * the client-supplied one) on success. Order matters: cheap checks (empty/size) run before the
 * byte-level sniff, which runs before the extension cross-check.
 */
function validateImageFile(file: UploadedPhotoFile): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (file.buffer.byteLength === 0) return { ok: false, error: "הקובץ ריק" };
  if (file.buffer.byteLength > MAX_SIZE_BYTES) return { ok: false, error: "הקובץ גדול מדי (מקסימום 3MB)" };

  const sniffedMimeType = sniffImageMimeType(file.buffer);
  if (!sniffedMimeType) return { ok: false, error: "יש להעלות קובץ JPG, PNG או WebP בלבד" };

  const extension = path.extname(file.filename).toLowerCase();
  const allowedExtensions = ALLOWED_EXTENSIONS_BY_MIME[sniffedMimeType] ?? [];
  if (!allowedExtensions.includes(extension)) {
    return { ok: false, error: "סיומת הקובץ לא תואמת לסוג התמונה בפועל" };
  }

  return { ok: true, mimeType: sniffedMimeType };
}

/**
 * Stores the photo and points the profile's disclosure preference at it.
 * Uploading implies intent to share it once matched, so this also flips
 * sharePhotoPostMatch on — the settings/privacy forms still show that as an
 * editable toggle, so the user can turn it back off without deleting the
 * file. The photo itself is never read by any pre-match code path (see
 * dto.ts) — only getConnectionDetail, after its own privacy recheck, ever
 * loads the bytes back out of storage.
 *
 * Orientation/distortion note (audited, not a new dependency): this app never serves the stored
 * file directly — both here (getOwnProfilePhotoDataUrl) and in connections/service.ts it's always
 * converted to a `data:` URL and rendered through a plain <img> with `object-cover`. Every evergreen
 * browser decodes `<img>` content (data URLs included) honoring embedded EXIF orientation by
 * default (the CSS Images spec's `image-orientation: from-image` initial value), so a portrait photo
 * from a phone camera is not stored or displayed sideways without any code here doing anything
 * special — and `object-cover` (used everywhere this photo is rendered, both this circular preview
 * and connections/ConnectionRoom.tsx's) crops rather than stretches, so the aspect ratio is never
 * distorted either. No image-processing dependency (sharp/jimp/etc.) exists in this codebase and
 * none was added — there is no re-encoding step, only pass-through storage, so there was nothing
 * for such a library to do here.
 */
export async function uploadProfilePhoto(userId: string, file: UploadedPhotoFile): Promise<UploadProfilePhotoResult> {
  const validation = validateImageFile(file);
  if (!validation.ok) return validation;

  const scanResult = await getMalwareScanner().scan(file.buffer, file.filename);
  if (!scanResult.clean) {
    logger.warn("profile photo rejected by scanner", { userId, reason: scanResult.reason });
    return { ok: false, error: "הקובץ נדחה על ידי בדיקת אבטחה" };
  }

  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
  const existing = await prisma.identityDisclosurePreference.findUnique({ where: { profileId: profile.id } });

  const storage = getStorage();
  const storageKey = generatePhotoStorageKey(userId, file.filename);
  await storage.put(storageKey, file.buffer);

  await prisma.identityDisclosurePreference.upsert({
    where: { profileId: profile.id },
    update: { photoStorageKey: storageKey, photoMimeType: validation.mimeType, sharePhotoPostMatch: true },
    create: { profileId: profile.id, photoStorageKey: storageKey, photoMimeType: validation.mimeType, sharePhotoPostMatch: true },
  });

  if (existing?.photoStorageKey) {
    await storage.delete(existing.photoStorageKey).catch((error) => {
      logger.error("failed to delete replaced profile photo", { userId, error });
    });
  }

  return { ok: true };
}

export async function deleteProfilePhoto(userId: string): Promise<void> {
  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
  const existing = await prisma.identityDisclosurePreference.findUnique({ where: { profileId: profile.id } });
  if (!existing?.photoStorageKey) return;

  await getStorage().delete(existing.photoStorageKey).catch((error) => {
    logger.error("failed to delete profile photo", { userId, error });
  });

  await prisma.identityDisclosurePreference.update({
    where: { profileId: profile.id },
    data: { photoStorageKey: null, photoMimeType: null, sharePhotoPostMatch: false },
  });
}

/** Own-photo preview for the settings/onboarding UI, as a data URL — never used for anyone else's photo. */
export async function getOwnProfilePhotoDataUrl(userId: string): Promise<string | null> {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const disclosure = await prisma.identityDisclosurePreference.findUnique({ where: { profileId: profile.id } });
  if (!disclosure?.photoStorageKey) return null;

  const buffer = await getStorage().get(disclosure.photoStorageKey);
  return `data:${disclosure.photoMimeType ?? "image/jpeg"};base64,${buffer.toString("base64")}`;
}
