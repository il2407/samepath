"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import {
  completeConnectionPreferences,
  completePrivacyOnboarding,
  saveProfileStepOne,
  updatePrivacySettings,
} from "@/modules/profiles/service";

export type ActionState = { ok: boolean; error?: string };

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

export async function saveProfileStepOneAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = stepOneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await saveProfileStepOne(user.id, parsed.data);
  revalidatePath("/app", "layout");
  redirect("/app/onboarding/privacy");
}

/** Same underlying update as onboarding step 1, but for the settings page — stays put instead of continuing the onboarding wizard. */
export async function updateProfileSettingsAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = stepOneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await saveProfileStepOne(user.id, parsed.data);
  revalidatePath("/app/settings/profile");
  return { ok: true };
}

const blockedCompanySchema = z.object({
  companyId: z.string().min(1),
  reason: z.enum(["FORMER_EMPLOYER", "INTERVIEWING", "CLIENT_OR_VENDOR", "OTHER"]),
  note: z.string().optional(),
});

const privacyStepSchema = z
  .object({
    employerConfirmed: z.boolean(),
    blockEntireCorporateGroup: z.boolean(),
    additionalBlockedCompanies: z.array(blockedCompanySchema),
    preMatchDisplayMode: z.enum(["ALIAS", "FIRST_NAME"]),
    aliasText: z.string().optional(),
    firstName: z.string().optional(),
    fullName: z.string().optional(),
    shareFullNamePostMatch: z.boolean(),
    sharePhotoPostMatch: z.boolean(),
    shareLinkedInPostMatch: z.boolean(),
    linkedInUrl: z.string().optional(),
    sharePreciseLocationPostMatch: z.boolean(),
    shareEmailPostMatch: z.boolean(),
    sharePhonePostMatch: z.boolean(),
    phoneNumber: z.string().optional(),
    resumeRetentionPreference: z.enum(["DELETE_AFTER_CONFIRMATION", "KEEP"]),
  })
  .refine((data) => data.employerConfirmed, {
    message: "יש לאשר את המעסיק הנוכחי כדי להמשיך",
    path: ["employerConfirmed"],
  })
  .refine((data) => data.preMatchDisplayMode !== "ALIAS" || !!data.aliasText?.trim(), {
    message: "יש להזין כינוי להצגה",
    path: ["aliasText"],
  })
  .refine((data) => data.preMatchDisplayMode !== "FIRST_NAME" || !!data.firstName?.trim(), {
    message: "יש להזין שם פרטי",
    path: ["firstName"],
  })
  .refine((data) => !data.shareFullNamePostMatch || !!data.fullName?.trim(), {
    message: "יש להזין שם מלא כדי לחשוף אותו לאחר אישור הדדי",
    path: ["fullName"],
  });

export async function completePrivacyOnboardingAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = privacyStepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await completePrivacyOnboarding(user.id, parsed.data);
  revalidatePath("/app", "layout");
  redirect("/app/onboarding/preferences");
}

const privacySettingsSchema = z
  .object({
    blockEntireCorporateGroup: z.boolean(),
    additionalBlockedCompanies: z.array(blockedCompanySchema),
    preMatchDisplayMode: z.enum(["ALIAS", "FIRST_NAME"]),
    aliasText: z.string().optional(),
    firstName: z.string().optional(),
    fullName: z.string().optional(),
    shareFullNamePostMatch: z.boolean(),
    sharePhotoPostMatch: z.boolean(),
    shareLinkedInPostMatch: z.boolean(),
    linkedInUrl: z.string().optional(),
    sharePreciseLocationPostMatch: z.boolean(),
    shareEmailPostMatch: z.boolean(),
    sharePhonePostMatch: z.boolean(),
    phoneNumber: z.string().optional(),
    resumeRetentionPreference: z.enum(["DELETE_AFTER_CONFIRMATION", "KEEP"]),
  })
  .refine((data) => data.preMatchDisplayMode !== "ALIAS" || !!data.aliasText?.trim(), {
    message: "יש להזין כינוי להצגה",
    path: ["aliasText"],
  })
  .refine((data) => data.preMatchDisplayMode !== "FIRST_NAME" || !!data.firstName?.trim(), {
    message: "יש להזין שם פרטי",
    path: ["firstName"],
  })
  .refine((data) => !data.shareFullNamePostMatch || !!data.fullName?.trim(), {
    message: "יש להזין שם מלא כדי לחשוף אותו לאחר אישור הדדי",
    path: ["fullName"],
  });

export async function updatePrivacySettingsAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = privacySettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await updatePrivacySettings(user.id, parsed.data);
  revalidatePath("/app/settings/privacy");
  return { ok: true };
}

const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startMinute: z.number().min(0).max(1439),
  endMinute: z.number().min(1).max(1440),
});

const connectionReasonEnum = z.enum([
  "SHARE_JOB_SEARCH",
  "ACCOUNTABILITY",
  "PROFESSIONAL_DISCUSSION",
  "LEARNING_TOGETHER",
  "CODING_PRACTICE",
  "SYSTEM_DESIGN",
  "INTERVIEW_SIMULATION",
  "OTHER",
]);

const preferencesStepSchema = z.object({
  peerMinExperienceMonths: z.number().min(0),
  peerMaxExperienceMonths: z.number().min(0),
  format: z.enum(["ONE_ON_ONE", "GROUP", "BOTH"]),
  cadence: z.enum(["ONE_TIME", "RECURRING", "BOTH"]),
  mode: z.enum(["ONLINE", "IN_PERSON", "BOTH"]),
  languageId: z.string().nullable(),
  timezone: z.string().min(1),
  reasons: z.array(connectionReasonEnum),
  availability: z.array(availabilitySlotSchema),
});

export async function completeConnectionPreferencesAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = preferencesStepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await completeConnectionPreferences(user.id, parsed.data);
  revalidatePath("/app", "layout");
  redirect("/app");
}
