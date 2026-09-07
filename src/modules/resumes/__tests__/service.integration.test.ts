import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import { getStorage } from "@/shared/storage";
import {
  uploadResume,
  getResumeStatusForUser,
  confirmResumeDraft,
  discardResumeUpload,
  retryResumeExtraction,
} from "@/modules/resumes/service";
import { PDF_MIME_TYPE } from "@/modules/resumes/text-extraction";
import { buildMinimalPdf } from "@/modules/resumes/__tests__/pdf-fixture";
import type { StoredExtractedResumeData } from "@/modules/resumes/dto";

beforeEach(async () => {
  await resetTestDatabase();
});

const RESUME_TEXT = "Acme Corp - Backend Developer\n01/2020 - Present";

function resumeFile(text = RESUME_TEXT) {
  return { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: buildMinimalPdf(text) };
}

describe("uploadResume", () => {
  it("rejects an unsupported mime type", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, { filename: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: Buffer.alloc(0) });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size limit", async () => {
    const user = await createTestUser();
    const oversized = Buffer.alloc(6 * 1024 * 1024);
    const result = await uploadResume(user.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: oversized });
    expect(result.ok).toBe(false);
  });

  it("stores the file, runs extraction inline, and produces a draft with a resolved company", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, resumeFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const upload = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: result.uploadId } });
    expect(upload.status).toBe("READY");

    const job = await prisma.resumeExtractionJob.findUniqueOrThrow({ where: { resumeUploadId: result.uploadId } });
    expect(job.status).toBe("SUCCEEDED");

    const draft = await prisma.resumeExtractionDraft.findUniqueOrThrow({ where: { resumeExtractionJobId: job.id } });
    const extracted = draft.extractedJson as unknown as StoredExtractedResumeData;
    expect(extracted.positions).toHaveLength(1);
    expect(extracted.positions[0]).toMatchObject({ companyName: "Acme Corp", title: "Backend Developer", isCurrent: true });

    const company = await prisma.company.findUniqueOrThrow({ where: { id: extracted.positions[0].companyId } });
    expect(company.canonicalName).toBe("Acme Corp");

    const stored = await getStorage().get(upload.storageKey);
    expect(stored.byteLength).toBeGreaterThan(0);
  });

  it("reuses an existing close-matching company instead of creating a duplicate", async () => {
    const existing = await prisma.company.create({ data: { canonicalName: "Acme Corp" } });
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, resumeFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const job = await prisma.resumeExtractionJob.findUniqueOrThrow({ where: { resumeUploadId: result.uploadId } });
    const draft = await prisma.resumeExtractionDraft.findUniqueOrThrow({ where: { resumeExtractionJobId: job.id } });
    const extracted = draft.extractedJson as unknown as StoredExtractedResumeData;
    expect(extracted.positions[0].companyId).toBe(existing.id);

    const companyCount = await prisma.company.count({ where: { canonicalName: "Acme Corp" } });
    expect(companyCount).toBe(1);
  });

  it("marks the job FAILED (and creates no draft) instead of throwing when text extraction fails", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: Buffer.from("not a real pdf") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const job = await prisma.resumeExtractionJob.findUniqueOrThrow({ where: { resumeUploadId: result.uploadId } });
    expect(job.status).toBe("FAILED");
    expect(job.error).toBeTruthy();

    const draft = await prisma.resumeExtractionDraft.findFirst({ where: { resumeExtractionJobId: job.id } });
    expect(draft).toBeNull();
  });

  it("fails the job with an EMPTY_TEXT_LAYER-tagged error for a file with no meaningful text (the scanned/image-only PDF signature)", async () => {
    const user = await createTestUser();
    // A structurally valid PDF whose content stream shows an empty string —
    // pdf-parse succeeds but returns ~no text, exactly like a scanned page.
    const result = await uploadResume(user.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: buildMinimalPdf("") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const job = await prisma.resumeExtractionJob.findUniqueOrThrow({ where: { resumeUploadId: result.uploadId } });
    expect(job.status).toBe("FAILED");
    expect(job.error).toMatch(/^EMPTY_TEXT_LAYER/);

    const status = await getResumeStatusForUser(user.user.id);
    expect(status?.extractionFailureReason).toBe("EMPTY_TEXT");
  });

  it("matches a target role, derives the professional field, and matches a region when their known labels appear in the text", async () => {
    const user = await createTestUser();
    const field = await prisma.professionalField.create({ data: { code: "software-engineering", labelHe: "הנדסת תוכנה", labelEn: "Software Engineering" } });
    await prisma.targetRole.create({
      data: { code: "backend-developer", professionalFieldId: field.id, labelHe: "מפתח/ת Backend", labelEn: "Backend Developer" },
    });
    const region = await prisma.region.create({ data: { code: "il-center", labelHe: "מרכז", labelEn: "Center" , kind: "BROAD_AREA" } });

    const text = "Acme Corp - Backend Developer\n01/2020 - Present\nLocation: Center";
    const result = await uploadResume(user.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: buildMinimalPdf(text) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const job = await prisma.resumeExtractionJob.findUniqueOrThrow({ where: { resumeUploadId: result.uploadId } });
    const draft = await prisma.resumeExtractionDraft.findUniqueOrThrow({ where: { resumeExtractionJobId: job.id } });
    const extracted = draft.extractedJson as unknown as StoredExtractedResumeData;

    expect(extracted.matchedTargetRoleIds).toHaveLength(1);
    expect(extracted.professionalFieldIdGuess).toBe(field.id);
    expect(extracted.matchedRegionId).toBe(region.id);
  });

  it("leaves professionalFieldIdGuess and matchedRegionId null when no known labels match", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, resumeFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const job = await prisma.resumeExtractionJob.findUniqueOrThrow({ where: { resumeUploadId: result.uploadId } });
    const draft = await prisma.resumeExtractionDraft.findUniqueOrThrow({ where: { resumeExtractionJobId: job.id } });
    const extracted = draft.extractedJson as unknown as StoredExtractedResumeData;

    expect(extracted.matchedTargetRoleIds).toEqual([]);
    expect(extracted.professionalFieldIdGuess).toBeNull();
    expect(extracted.matchedRegionId).toBeNull();
    expect(extracted.shortIntroGuess).toBeNull();
  });
});

describe("retryResumeExtraction", () => {
  it("re-runs extraction against the current stored file without creating a duplicate job row", async () => {
    const user = await createTestUser();
    const initial = await uploadResume(user.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: Buffer.from("not a real pdf") });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;

    const failedJob = await prisma.resumeExtractionJob.findUniqueOrThrow({ where: { resumeUploadId: initial.uploadId } });
    expect(failedJob.status).toBe("FAILED");
    expect(failedJob.attempt).toBe(1);

    const upload = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: initial.uploadId } });
    // Simulate "the underlying issue was transient" by replacing the stored
    // file with a valid one, then retrying — retryResumeExtraction reads
    // whatever is currently in storage, not a stale in-memory buffer.
    await getStorage().put(upload.storageKey, buildMinimalPdf(RESUME_TEXT));

    const retryResult = await retryResumeExtraction(user.user.id, initial.uploadId);
    expect(retryResult.ok).toBe(true);

    const jobs = await prisma.resumeExtractionJob.findMany({ where: { resumeUploadId: initial.uploadId } });
    expect(jobs).toHaveLength(1); // reused the same row, never duplicated
    expect(jobs[0].status).toBe("SUCCEEDED");
    expect(jobs[0].attempt).toBe(2);

    const draft = await prisma.resumeExtractionDraft.findUniqueOrThrow({ where: { resumeExtractionJobId: jobs[0].id } });
    const extracted = draft.extractedJson as unknown as StoredExtractedResumeData;
    expect(extracted.positions).toHaveLength(1);
  });

  it("refuses to retry another user's upload", async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    const result = await uploadResume(owner.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: Buffer.from("garbage") });
    if (!result.ok) throw new Error("upload failed");

    await expect(retryResumeExtraction(attacker.user.id, result.uploadId)).rejects.toThrow();
  });

  it("returns a Hebrew error instead of retrying once the upload is no longer READY (already confirmed/discarded)", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, resumeFile());
    if (!result.ok) throw new Error("upload failed");
    await discardResumeUpload(user.user.id, result.uploadId);

    const retryResult = await retryResumeExtraction(user.user.id, result.uploadId);
    expect(retryResult.ok).toBe(false);
  });

  it("returns a Hebrew error instead of crashing when the stored file no longer exists", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: Buffer.from("garbage") });
    if (!result.ok) throw new Error("upload failed");

    const upload = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: result.uploadId } });
    await getStorage().delete(upload.storageKey); // out-of-band deletion, upload row still says READY

    const retryResult = await retryResumeExtraction(user.user.id, result.uploadId);
    expect(retryResult.ok).toBe(false);
  });
});

describe("getResumeStatusForUser", () => {
  it("returns null when the user has never uploaded a resume", async () => {
    const user = await createTestUser();
    expect(await getResumeStatusForUser(user.user.id)).toBeNull();
  });

  it("surfaces the unconfirmed draft after a successful upload", async () => {
    const user = await createTestUser();
    await uploadResume(user.user.id, resumeFile());
    const status = await getResumeStatusForUser(user.user.id);
    expect(status?.status).toBe("READY");
    expect(status?.extractionFailed).toBe(false);
    expect(status?.draft?.extracted.positions).toHaveLength(1);
  });

  it("reports extractionFailed and no draft after a failed extraction", async () => {
    const user = await createTestUser();
    await uploadResume(user.user.id, { filename: "resume.pdf", mimeType: PDF_MIME_TYPE, buffer: Buffer.from("garbage") });
    const status = await getResumeStatusForUser(user.user.id);
    expect(status?.extractionFailed).toBe(true);
    expect(status?.draft).toBeNull();
  });
});

describe("confirmResumeDraft", () => {
  it("records a confirmation and deletes the file by default", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, resumeFile());
    if (!result.ok) throw new Error("upload failed");

    const before = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: result.uploadId } });
    await confirmResumeDraft(user.user.id, result.uploadId, false);

    const after = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: result.uploadId } });
    expect(after.status).toBe("DELETED");
    await expect(getStorage().get(before.storageKey)).rejects.toThrow();

    const confirmation = await prisma.userConfirmation.findFirst({ where: { userId: user.user.id, type: "RESUME_DRAFT_CONFIRMED" } });
    expect(confirmation).not.toBeNull();

    const draft = await prisma.resumeExtractionDraft.findFirst({ where: { userId: user.user.id } });
    expect(draft?.confirmedAt).not.toBeNull();

    const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: user.user.id } });
    expect(profile.cvVerifiedAt).not.toBeNull();
  });

  it("keeps the file when keepFile is true", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, resumeFile());
    if (!result.ok) throw new Error("upload failed");

    await confirmResumeDraft(user.user.id, result.uploadId, true);

    const after = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: result.uploadId } });
    expect(after.status).toBe("READY");
    const stored = await getStorage().get(after.storageKey);
    expect(stored.byteLength).toBeGreaterThan(0);
  });

  it("refuses to confirm another user's upload", async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    const result = await uploadResume(owner.user.id, resumeFile());
    if (!result.ok) throw new Error("upload failed");

    await expect(confirmResumeDraft(attacker.user.id, result.uploadId, false)).rejects.toThrow();
  });
});

describe("discardResumeUpload", () => {
  it("deletes the file and marks the upload DELETED", async () => {
    const user = await createTestUser();
    const result = await uploadResume(user.user.id, resumeFile());
    if (!result.ok) throw new Error("upload failed");

    await discardResumeUpload(user.user.id, result.uploadId);

    const after = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: result.uploadId } });
    expect(after.status).toBe("DELETED");
    await expect(getStorage().get(after.storageKey)).rejects.toThrow();

    const status = await getResumeStatusForUser(user.user.id);
    expect(status?.draft).toBeNull();
  });

  it("refuses to discard another user's upload", async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    const result = await uploadResume(owner.user.id, resumeFile());
    if (!result.ok) throw new Error("upload failed");

    await expect(discardResumeUpload(attacker.user.id, result.uploadId)).rejects.toThrow();
  });
});
