import "server-only";
import { prisma } from "@/shared/db";
import { getStorage, generateResumeStorageKey } from "@/shared/storage";
import { getMalwareScanner } from "@/modules/resumes/malware-scan";
import { extractText, looksLikeEmptyTextLayer, PDF_MIME_TYPE, DOCX_MIME_TYPE } from "@/modules/resumes/text-extraction";
import { getResumeParser } from "@/modules/resumes/parser";
import { toMonthString, type StoredExtractedResumeData } from "@/modules/resumes/dto";
import { resolveOrCreateCompanyByRawName } from "@/modules/companies/service";
import type { Prisma, ResumeUploadStatus } from "@/generated/prisma/client";

const ALLOWED_MIME_TYPES = new Set([PDF_MIME_TYPE, DOCX_MIME_TYPE]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PARSER_VERSION = "deterministic-v1";

export interface UploadedFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export type UploadResumeResult = { ok: true; uploadId: string } | { ok: false; error: string };

/**
 * Stores the file, runs the (stubbed) malware scan, and — if clean — runs
 * text extraction and the deterministic parser inline. There is no job
 * queue in this MVP (same lazy-execution philosophy as the rest of the
 * app), so "queued" work just means "run synchronously right now"; the
 * ResumeExtractionJob row still records status/timing/error so the schema
 * and UI are ready for a real async worker later without changes.
 */
export async function uploadResume(userId: string, file: UploadedFile): Promise<UploadResumeResult> {
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    return { ok: false, error: "יש להעלות קובץ PDF או Word (docx) בלבד" };
  }
  if (file.buffer.byteLength === 0) return { ok: false, error: "הקובץ ריק" };
  if (file.buffer.byteLength > MAX_SIZE_BYTES) return { ok: false, error: "הקובץ גדול מדי (מקסימום 5MB)" };

  const storage = getStorage();
  const storageKey = generateResumeStorageKey(userId, file.filename);
  await storage.put(storageKey, file.buffer);

  const upload = await prisma.resumeUpload.create({
    data: {
      userId,
      storageKey,
      originalFilename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.buffer.byteLength,
      status: "UPLOADED",
    },
  });

  await prisma.resumeUpload.update({ where: { id: upload.id }, data: { status: "SCANNING" } });
  const scanResult = await getMalwareScanner().scan(file.buffer, file.filename);
  if (!scanResult.clean) {
    await storage.delete(storageKey);
    await prisma.resumeUpload.update({ where: { id: upload.id }, data: { status: "REJECTED", deletedAt: new Date() } });
    return { ok: false, error: "הקובץ נדחה על ידי בדיקת אבטחה" };
  }
  await prisma.resumeUpload.update({ where: { id: upload.id }, data: { status: "READY" } });

  await runExtractionJob(upload.id, userId, file.buffer, file.mimeType);
  return { ok: true, uploadId: upload.id };
}

async function runExtractionJob(resumeUploadId: string, userId: string, buffer: Buffer, mimeType: string): Promise<void> {
  // resumeUploadId is unique on this table (one job per upload), so a retry
  // of a previously FAILED job must re-use that row rather than create a
  // second one — upsert makes both "first run" and "retry" safe in one call.
  // `attempt` (already in the schema) increments on retry rather than
  // resetting, so it stays a true count of how many times this upload's
  // extraction has actually run.
  const job = await prisma.resumeExtractionJob.upsert({
    where: { resumeUploadId },
    create: { resumeUploadId, status: "RUNNING", startedAt: new Date(), attempt: 1 },
    update: { status: "RUNNING", startedAt: new Date(), finishedAt: null, error: null, attempt: { increment: 1 } },
  });

  try {
    const text = await extractText(buffer, mimeType);

    // A scanned/image-only PDF has no text layer at all — pdf-parse can't
    // OCR it, so it returns empty/near-empty text instead of throwing. Fail
    // the job with a recognizable error tag so getResumeStatusForUser can
    // tell the user something more useful than a generic "extraction
    // failed" (see text-extraction.ts and docs/resume-extraction-approach.md).
    if (looksLikeEmptyTextLayer(text)) {
      throw new Error("EMPTY_TEXT_LAYER: no extractable text found (likely a scanned/image-only file)");
    }

    const [tags, languages, targetRoles, regions] = await Promise.all([
      prisma.tag.findMany({ where: { isActive: true, kind: { in: ["SKILL", "DOMAIN"] } }, select: { id: true, labelHe: true, labelEn: true } }),
      prisma.language.findMany({ select: { id: true, labelHe: true, labelEn: true } }),
      prisma.targetRole.findMany({ where: { isActive: true }, select: { id: true, labelHe: true, labelEn: true, professionalFieldId: true } }),
      prisma.region.findMany({ select: { id: true, labelHe: true, labelEn: true } }),
    ]);

    const parsed = await getResumeParser().parse(text, { knownTags: tags, knownLanguages: languages, knownTargetRoles: targetRoles, knownRegions: regions });

    const positions = await Promise.all(
      parsed.positions.map(async (p) => {
        const company = await resolveOrCreateCompanyByRawName(p.companyRaw);
        return {
          companyId: company.id,
          companyName: company.canonicalName,
          companyRaw: p.companyRaw,
          title: p.title,
          startMonth: toMonthString(p.startYear, p.startMonth),
          endMonth: p.endYear && p.endMonth ? toMonthString(p.endYear, p.endMonth) : null,
          isCurrent: p.isCurrent,
        };
      }),
    );

    // A target role always belongs to exactly one professional field, so
    // the first matched role's field is a safe (never-guessed-if-empty)
    // stand-in for "which professional field is this resume for" — a field
    // the deterministic parser otherwise has no reliable way to infer.
    const professionalFieldIdGuess =
      parsed.matchedTargetRoleIds.length > 0
        ? (targetRoles.find((r) => r.id === parsed.matchedTargetRoleIds[0])?.professionalFieldId ?? null)
        : null;

    const draftData: StoredExtractedResumeData = {
      positions,
      currentRoleTitleGuess: parsed.currentRoleTitleGuess,
      matchedTagIds: parsed.matchedTagIds,
      matchedLanguageIds: parsed.matchedLanguageIds,
      matchedTargetRoleIds: parsed.matchedTargetRoleIds,
      professionalFieldIdGuess,
      matchedRegionId: parsed.matchedRegionId,
      shortIntroGuess: parsed.shortIntroGuess,
    };

    await prisma.$transaction([
      prisma.resumeExtractionJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", finishedAt: new Date() } }),
      prisma.resumeExtractionDraft.create({
        data: {
          resumeExtractionJobId: job.id,
          userId,
          extractedJson: draftData as unknown as Prisma.InputJsonValue,
          parserVersion: PARSER_VERSION,
          parserSource: "DETERMINISTIC",
        },
      }),
    ]);
  } catch (error) {
    await prisma.resumeExtractionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", finishedAt: new Date(), error: error instanceof Error ? error.message : "unknown error" },
    });
  }
}

export type ExtractionFailureReason = "EMPTY_TEXT" | "OTHER";

export interface ResumeStatusView {
  uploadId: string;
  originalFilename: string;
  status: ResumeUploadStatus;
  extractionFailed: boolean;
  /** Only meaningful when extractionFailed is true. "EMPTY_TEXT" (likely a scanned/image-only file — see text-extraction.ts's looksLikeEmptyTextLayer) gets a specific, more useful Hebrew message than the generic "extraction failed" case, and retrying against the same file is pointless (there is no text there to find). */
  extractionFailureReason: ExtractionFailureReason | null;
  draft: { extracted: StoredExtractedResumeData } | null;
}

/** The most recent resume upload for a user, with its draft if one is still awaiting confirmation. Used to decide what the onboarding page shows: an upload prompt, a review form, or a "extraction failed, fill in manually" notice. */
export async function getResumeStatusForUser(userId: string): Promise<ResumeStatusView | null> {
  const upload = await prisma.resumeUpload.findFirst({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    include: { extractionJob: { include: { draft: true } } },
  });
  if (!upload) return null;

  const draft = upload.extractionJob?.draft;
  // Only a READY upload's draft is still live — once discarded or
  // confirmed, the upload moves to DELETED, and a draft attached to it must
  // stop resurfacing even though the draft row itself still exists.
  const hasUnconfirmedDraft = Boolean(draft && !draft.confirmedAt && upload.status === "READY");
  const extractionFailed = upload.extractionJob?.status === "FAILED";

  return {
    uploadId: upload.id,
    originalFilename: upload.originalFilename,
    status: upload.status,
    extractionFailed,
    extractionFailureReason: !extractionFailed
      ? null
      : upload.extractionJob?.error?.startsWith("EMPTY_TEXT_LAYER")
        ? "EMPTY_TEXT"
        : "OTHER",
    draft: hasUnconfirmedDraft ? { extracted: draft!.extractedJson as unknown as StoredExtractedResumeData } : null,
  };
}

export type RetryExtractionResult = { ok: true } | { ok: false; error: string };

/**
 * Re-runs extraction against the already-stored file for a previously
 * failed job, without requiring the user to re-select and re-upload the
 * same file (§14: retry state for the extraction pipeline). Only valid
 * while the original upload is still READY and its file still exists in
 * storage — both true for a job that failed extraction (the file is only
 * ever deleted at confirm time or on discard, neither of which happened
 * here). Deliberately not offered for an EMPTY_TEXT_LAYER failure by the
 * caller UI: retrying against a file with no text layer at all would fail
 * identically every time.
 */
export async function retryResumeExtraction(userId: string, uploadId: string): Promise<RetryExtractionResult> {
  const upload = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: uploadId } });
  if (upload.userId !== userId) throw new Error("not your upload");
  if (upload.status !== "READY") {
    return { ok: false, error: "לא ניתן לנסות שוב עבור קובץ זה — יש להעלות קובץ חדש" };
  }

  let buffer: Buffer;
  try {
    buffer = await getStorage().get(upload.storageKey);
  } catch {
    return { ok: false, error: "הקובץ המקורי כבר לא זמין — יש להעלות קובץ חדש" };
  }

  await runExtractionJob(uploadId, userId, buffer, upload.mimeType);
  return { ok: true };
}

/**
 * Finalizes onboarding from a resume draft: records the confirmation, and —
 * unless the user opted to keep it — deletes the original file. Applying
 * the (possibly user-edited) extracted fields to the profile itself is the
 * caller's job via the existing saveProfileStepOne, so this only owns the
 * resume-specific bookkeeping.
 */
export async function confirmResumeDraft(userId: string, uploadId: string, keepFile: boolean): Promise<void> {
  const upload = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: uploadId } });
  if (upload.userId !== userId) throw new Error("not your upload");

  const draft = await prisma.resumeExtractionDraft.findFirst({
    where: { userId, resumeExtractionJob: { resumeUploadId: uploadId } },
  });

  await prisma.$transaction([
    ...(draft ? [prisma.resumeExtractionDraft.update({ where: { id: draft.id }, data: { confirmedAt: new Date() } })] : []),
    prisma.userConfirmation.create({ data: { userId, type: "RESUME_DRAFT_CONFIRMED", payload: { uploadId } } }),
    // The trust signal shown to other users (see PreMatchCandidateDTO.cvVerified):
    // set once a real CV has been reviewed and confirmed, independent of
    // whether the file itself is kept afterward.
    prisma.professionalProfile.update({ where: { userId }, data: { cvVerifiedAt: new Date() } }),
  ]);

  if (!keepFile && upload.status !== "DELETED") {
    try {
      await getStorage().delete(upload.storageKey);
      await prisma.resumeUpload.update({ where: { id: uploadId }, data: { status: "DELETED", deletedAt: new Date() } });
    } catch (error) {
      // Best-effort cleanup only: a failure here must never fail onboarding
      // (the profile is already saved by the time this runs). Logged, not
      // swallowed — the upload status is deliberately left as-is (not
      // marked DELETED) so it stays a truthful record that the file may
      // still exist.
      console.error("failed to delete resume file after confirmation", { uploadId, error });
    }
  }
}

/** Discards a pending upload/draft without confirming — e.g. the user chooses to start over with manual entry. */
export async function discardResumeUpload(userId: string, uploadId: string): Promise<void> {
  const upload = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: uploadId } });
  if (upload.userId !== userId) throw new Error("not your upload");

  if (upload.status !== "DELETED") {
    try {
      await getStorage().delete(upload.storageKey);
    } catch (error) {
      console.error("failed to delete discarded resume file", { uploadId, error });
    }
  }
  await prisma.resumeUpload.update({ where: { id: uploadId }, data: { status: "DELETED", deletedAt: new Date() } });
}
