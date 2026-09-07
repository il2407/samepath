import "server-only";
import { prisma } from "@/shared/db";
import { getStorage, generatePhotoStorageKey } from "@/shared/storage";
import { getMalwareScanner } from "@/modules/resumes/malware-scan";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 3 * 1024 * 1024;

export interface UploadedPhotoFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export type UploadProfilePhotoResult = { ok: true } | { ok: false; error: string };

/**
 * Stores the photo and points the profile's disclosure preference at it.
 * Uploading implies intent to share it once matched, so this also flips
 * sharePhotoPostMatch on — the settings/privacy forms still show that as an
 * editable toggle, so the user can turn it back off without deleting the
 * file. The photo itself is never read by any pre-match code path (see
 * dto.ts) — only getConnectionDetail, after its own privacy recheck, ever
 * loads the bytes back out of storage.
 */
export async function uploadProfilePhoto(userId: string, file: UploadedPhotoFile): Promise<UploadProfilePhotoResult> {
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    return { ok: false, error: "יש להעלות קובץ JPG, PNG או WebP בלבד" };
  }
  if (file.buffer.byteLength === 0) return { ok: false, error: "הקובץ ריק" };
  if (file.buffer.byteLength > MAX_SIZE_BYTES) return { ok: false, error: "הקובץ גדול מדי (מקסימום 3MB)" };

  const scanResult = await getMalwareScanner().scan(file.buffer, file.filename);
  if (!scanResult.clean) return { ok: false, error: "הקובץ נדחה על ידי בדיקת אבטחה" };

  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
  const existing = await prisma.identityDisclosurePreference.findUnique({ where: { profileId: profile.id } });

  const storage = getStorage();
  const storageKey = generatePhotoStorageKey(userId, file.filename);
  await storage.put(storageKey, file.buffer);

  await prisma.identityDisclosurePreference.upsert({
    where: { profileId: profile.id },
    update: { photoStorageKey: storageKey, photoMimeType: file.mimeType, sharePhotoPostMatch: true },
    create: { profileId: profile.id, photoStorageKey: storageKey, photoMimeType: file.mimeType, sharePhotoPostMatch: true },
  });

  if (existing?.photoStorageKey) {
    await storage.delete(existing.photoStorageKey).catch((error) => {
      console.error("failed to delete replaced profile photo", { userId, error });
    });
  }

  return { ok: true };
}

export async function deleteProfilePhoto(userId: string): Promise<void> {
  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
  const existing = await prisma.identityDisclosurePreference.findUnique({ where: { profileId: profile.id } });
  if (!existing?.photoStorageKey) return;

  await getStorage().delete(existing.photoStorageKey).catch((error) => {
    console.error("failed to delete profile photo", { userId, error });
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
