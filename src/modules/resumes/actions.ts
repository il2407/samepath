"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { saveProfileStepOne, type ProfileStepOneInput } from "@/modules/profiles/service";
import { uploadResume, confirmResumeDraft, discardResumeUpload } from "@/modules/resumes/service";

export type ActionState = { ok: boolean; error?: string };

export async function uploadResumeAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "לא נבחר קובץ" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadResume(user.id, { filename: file.name, mimeType: file.type, buffer });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/onboarding/profile");
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

export async function discardResumeDraftAction(uploadId: string): Promise<ActionState> {
  const user = await requireUser();
  await discardResumeUpload(user.id, uploadId);
  revalidatePath("/app/onboarding/profile");
  return { ok: true };
}
