import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import { getStorage } from "@/shared/storage";
import { uploadProfilePhoto, deleteProfilePhoto, getOwnProfilePhotoDataUrl } from "@/modules/profiles/photo";

// Lets one test exercise the malware-scan-rejected branch without a real scanner (NoopScanner
// always reports clean — see resumes/malware-scan.ts) while every other test in this file keeps
// the normal "clean" behavior.
let scannerClean = true;
vi.mock("@/modules/resumes/malware-scan", () => ({
  getMalwareScanner: () => ({
    scan: async () => (scannerClean ? { clean: true } : { clean: false, reason: "test-flagged" }),
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  scannerClean = true;
});

// Minimal-but-real magic-byte headers for each accepted format — sniffing only ever inspects the
// header, so these don't need to be full, valid, decodable images.
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const WEBP_BYTES = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x00, 0x00, 0x00, 0x00]), Buffer.from("WEBP")]);

function jpegFile(filename = "photo.jpg") {
  return { filename, mimeType: "image/jpeg", buffer: JPEG_BYTES };
}

describe("uploadProfilePhoto", () => {
  it("rejects content whose magic bytes don't match any supported image format, regardless of the claimed mimeType", async () => {
    const user = await createTestUser();
    const result = await uploadProfilePhoto(user.user.id, {
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("<script>not an image</script>"),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a file whose extension doesn't match its sniffed content type", async () => {
    const user = await createTestUser();
    // Real PNG magic bytes, but named as a .jpg — extension/content mismatch.
    const result = await uploadProfilePhoto(user.user.id, { filename: "photo.jpg", mimeType: "image/png", buffer: PNG_BYTES });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", async () => {
    const user = await createTestUser();
    const result = await uploadProfilePhoto(user.user.id, { filename: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the 3MB size limit", async () => {
    const user = await createTestUser();
    const oversized = Buffer.concat([JPEG_BYTES, Buffer.alloc(4 * 1024 * 1024)]);
    const result = await uploadProfilePhoto(user.user.id, { filename: "photo.jpg", mimeType: "image/jpeg", buffer: oversized });
    expect(result.ok).toBe(false);
  });

  it("rejects a file the malware scanner flags as unclean", async () => {
    scannerClean = false;
    const user = await createTestUser();
    const result = await uploadProfilePhoto(user.user.id, jpegFile());
    expect(result.ok).toBe(false);
  });

  it("accepts a valid PNG and a valid WebP by sniffed content, not just JPEG", async () => {
    const user = await createTestUser();
    const pngResult = await uploadProfilePhoto(user.user.id, { filename: "photo.png", mimeType: "image/png", buffer: PNG_BYTES });
    expect(pngResult.ok).toBe(true);

    const webpResult = await uploadProfilePhoto(user.user.id, { filename: "photo.webp", mimeType: "image/webp", buffer: WEBP_BYTES });
    expect(webpResult.ok).toBe(true);
  });

  it("stores the file and points the disclosure preference at it, flipping sharePhotoPostMatch on", async () => {
    const user = await createTestUser();
    const result = await uploadProfilePhoto(user.user.id, jpegFile());
    expect(result.ok).toBe(true);

    const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: user.user.id } });
    const disclosure = await prisma.identityDisclosurePreference.findUniqueOrThrow({ where: { profileId: profile.id } });
    expect(disclosure.photoStorageKey).toBeTruthy();
    expect(disclosure.photoMimeType).toBe("image/jpeg");
    expect(disclosure.sharePhotoPostMatch).toBe(true);

    const stored = await getStorage().get(disclosure.photoStorageKey!);
    expect(stored.byteLength).toBeGreaterThan(0);
  });

  it("stores the sniffed mime type, not the client-supplied one, when they disagree", async () => {
    const user = await createTestUser();
    // Client claims JPEG, but the bytes are really a PNG — the stored type should reflect reality.
    const result = await uploadProfilePhoto(user.user.id, { filename: "photo.png", mimeType: "image/jpeg", buffer: PNG_BYTES });
    expect(result.ok).toBe(true);

    const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: user.user.id } });
    const disclosure = await prisma.identityDisclosurePreference.findUniqueOrThrow({ where: { profileId: profile.id } });
    expect(disclosure.photoMimeType).toBe("image/png");
  });

  it("replaces an existing photo: deletes the old storage object and stores the new one", async () => {
    const user = await createTestUser();
    const first = await uploadProfilePhoto(user.user.id, jpegFile());
    expect(first.ok).toBe(true);

    const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: user.user.id } });
    const afterFirst = await prisma.identityDisclosurePreference.findUniqueOrThrow({ where: { profileId: profile.id } });
    const oldKey = afterFirst.photoStorageKey!;

    const second = await uploadProfilePhoto(user.user.id, { filename: "photo.png", mimeType: "image/png", buffer: PNG_BYTES });
    expect(second.ok).toBe(true);

    const afterSecond = await prisma.identityDisclosurePreference.findUniqueOrThrow({ where: { profileId: profile.id } });
    expect(afterSecond.photoStorageKey).not.toBe(oldKey);
    await expect(getStorage().get(oldKey)).rejects.toThrow();
    const stored = await getStorage().get(afterSecond.photoStorageKey!);
    expect(stored.byteLength).toBeGreaterThan(0);
  });
});

describe("deleteProfilePhoto", () => {
  it("deletes the stored file and clears the disclosure fields", async () => {
    const user = await createTestUser();
    const uploadResult = await uploadProfilePhoto(user.user.id, jpegFile());
    expect(uploadResult.ok).toBe(true);

    const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: user.user.id } });
    const before = await prisma.identityDisclosurePreference.findUniqueOrThrow({ where: { profileId: profile.id } });
    const key = before.photoStorageKey!;

    await deleteProfilePhoto(user.user.id);

    const after = await prisma.identityDisclosurePreference.findUniqueOrThrow({ where: { profileId: profile.id } });
    expect(after.photoStorageKey).toBeNull();
    expect(after.photoMimeType).toBeNull();
    expect(after.sharePhotoPostMatch).toBe(false);
    await expect(getStorage().get(key)).rejects.toThrow();
  });

  it("is a no-op when the user has no photo", async () => {
    const user = await createTestUser();
    await expect(deleteProfilePhoto(user.user.id)).resolves.toBeUndefined();
  });
});

describe("getOwnProfilePhotoDataUrl", () => {
  it("returns null when the user has never uploaded a photo", async () => {
    const user = await createTestUser();
    expect(await getOwnProfilePhotoDataUrl(user.user.id)).toBeNull();
  });

  it("returns null after a photo has been deleted", async () => {
    const user = await createTestUser();
    await uploadProfilePhoto(user.user.id, jpegFile());
    await deleteProfilePhoto(user.user.id);
    expect(await getOwnProfilePhotoDataUrl(user.user.id)).toBeNull();
  });

  it("returns a base64 data URL matching the stored mime type when a photo exists", async () => {
    const user = await createTestUser();
    await uploadProfilePhoto(user.user.id, jpegFile());
    const dataUrl = await getOwnProfilePhotoDataUrl(user.user.id);
    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });
});
