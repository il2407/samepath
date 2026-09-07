"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { saveProfileStepOne, type ProfileStepOneInput } from "@/modules/profiles/service";
import { uploadResume, confirmResumeDraft, discardResumeUpload, retryResumeExtraction } from "@/modules/resumes/service";
import { rateLimit } from "@/shared/rate-limit";

export type ActionState = { ok: boolean; error?: string };

export async function uploadResumeAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  // Each upload runs real PDF/DOCX parsing and can create new company rows
  // — cheap enough per call to be a real spam/cost vector without a cap.
  const limited = rateLimit(`resume:upload:${user.id}`, 10, 60 * 60 * 1000);
  if (!limited.allowed) return { ok: false, error: "יותר מדי העלאות. נסו שוב בעוד כשעה" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "לא נבחר קובץ" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadResume(user.id, { filename: file.name, mimeType: file.type, buffer });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/onboarding/profile");
  revalidatePath("/app/settings/profile");
  return { ok: true };
}

const positionSchema = z.object({
  companyId: z.string().nullable().optional(),
  companyRaw: z.string().min(1, "שם החברה נדרש"),
  title: z.string().min(1, "תפקיד נדרש"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  isCurrent: z.boolean(),
});

const stepOneSchema = z.object({
  professionalFieldId: z.string().min(1),
  targetRoleIds: z.array(z.string()).min(1, "יש לבחור לפחות תפקיד יעד אחד"),
  currentRoleTitle: z.string().min(1, "יש להזין תפקיד נוכחי"),
  regionId: z.string().nullable(),
  shortIntro: z.string().max(400, "עד 400 תווים"),
  tagIds: z.array(z.string()),
  languageIds: z.array(z.string()).min(1, "יש לבחור לפחות שפה אחת"),
  positions: z.array(positionSchema),
});

const confirmSchema = z.object({
  uploadId: z.string().min(1),
  keepFile: z.boolean(),
  profile: stepOneSchema,
});

/** Saves the (possibly user-edited) profile from a resume draft and finalizes the resume record in one step, then continues onboarding exactly like the manual-entry path. */
export async function confirmResumeDraftAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await saveProfileStepOne(user.id, parsed.data.profile as ProfileStepOneInput);
  await confirmResumeDraft(user.id, parsed.data.uploadId, parsed.data.keepFile);

  revalidatePath("/app", "layout");
  redirect("/app/onboarding/privacy");
}

/** Re-runs extraction against the already-stored file for a previously failed job — see resumes/service.ts's retryResumeExtraction for why this doesn't need a fresh upload. */
export async function retryResumeExtractionAction(uploadId: string): Promise<ActionState> {
  const user = await requireUser();

  // Re-running extraction is comparable in cost to a fresh upload (same
  // parsing work), so it shares the upload rate-limit bucket rather than
  // getting its own unlimited allowance.
  const limited = rateLimit(`resume:upload:${user.id}`, 10, 60 * 60 * 1000);
  if (!limited.allowed) return { ok: false, error: "יותר מדי נסיונות. נסו שוב בעוד כשעה" };

  const result = await retryResumeExtraction(user.id, uploadId);
  if (!result.ok) return result;

  revalidatePath("/app/onboarding/profile");
  revalidatePath("/app/settings/profile");
  return { ok: true };
}

export async function discardResumeDraftAction(uploadId: string): Promise<ActionState> {
  const user = await requireUser();
  await discardResumeUpload(user.id, uploadId);
  revalidatePath("/app/onboarding/profile");
  revalidatePath("/app/settings/profile");
  return { ok: true };
}

/**
 * The settings-page counterpart to confirmResumeDraftAction: for a user who
 * already has an active profile and only wants the "CV verified" mark, not
 * a full re-run of the profile-edit form. Confirms the resume bookkeeping
 * (and therefore ProfessionalProfile.cvVerifiedAt) without touching any
 * other profile field, and stays on the settings page instead of
 * continuing the onboarding wizard.
 */
export async function verifyResumeFromSettingsAction(input: { uploadId: string; keepFile: boolean }): Promise<ActionState> {
  const user = await requireUser();
  await confirmResumeDraft(user.id, input.uploadId, input.keepFile);
  revalidatePath("/app/settings/profile");
  return { ok: true };
}
