"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import {
  activateProfile,
  completeConnectionPreferences,
  completePrivacyOnboarding,
  saveProfileStepOne,
  updatePrivacySettings,
} from "@/modules/profiles/service";
import { uploadProfilePhoto, deleteProfilePhoto } from "@/modules/profiles/photo";
import { rateLimit } from "@/shared/rate-limit";
import { generateSuggestionsForUser } from "@/modules/matching/service";

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
  positions: z.array(positionSchema),
  gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
  linkedInUrl: z.string().min(1, "יש להזין קישור לפרופיל LinkedIn").url("קישור לא תקין"),
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
  // Profile fields feed scoring directly (target roles, field, skills,
  // region) — regenerate suggestions synchronously so existing
  // empty slots reflect the new profile immediately, same call the manual
  // "Find matches" button and onboarding activation use (matching/job.ts's
  // "single shared unit of work" rule; see generateSuggestionsForUser).
  await generateSuggestionsForUser(user.id);
  revalidatePath("/app/settings/profile");
  revalidatePath("/app/matches");
  return { ok: true };
}

const blockedCompanySchema = z.object({
  companyId: z.string().min(1),
  reason: z.enum(["FORMER_EMPLOYER", "INTERVIEWING", "CLIENT_OR_VENDOR", "OTHER"]),
  note: z.string().optional(),
});

const privacyStepSchema = z
  .object({
    additionalBlockedCompanies: z.array(blockedCompanySchema),
    fullName: z.string().optional(),
    shareCompanyPreMatch: z.boolean(),
    shareFullNamePostMatch: z.boolean(),
    sharePhotoPostMatch: z.boolean(),
    phoneNumber: z.string().optional(),
    // shareEmailPostMatch/sharePhonePostMatch default to false here — the
    // onboarding step has no email/phone-reveal UI (contact info is only
    // ever opted into later, from settings; see PrivacyStepForm.tsx and
    // dto.ts's design note), so onboarding always submits the off default.
    shareEmailPostMatch: z.boolean().default(false),
    sharePhonePostMatch: z.boolean().default(false),
    // No blockEntireCorporateGroup (backlog item 6 — no longer
    // user-configurable), and no sharePreciseLocationPostMatch (backlog item
    // 9 — automatic reveal at the CONNECTED stage) — see PrivacyStepInput in
    // profiles/service.ts. No LinkedIn here anymore either — it moved to the
    // profile step (stepOneSchema above), required there, and always
    // reveals automatically at the CONNECTED stage.
    //
    // No resumeRetentionPreference here — see the comment on
    // PrivacyStepInput in profiles/service.ts for why the onboarding step no
    // longer collects this (the duplicated résumé-retention controls fix).
    //
    // No employerConfirmed here (WS5) — the explicit checkbox/hard gate was
    // removed from this step; completePrivacyOnboarding now sets
    // currentCompanyConfirmedAt implicitly, and the overview page's final
    // review screen is where the confirmed employer is shown and can be
    // edited before activateProfile re-checks it.
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
    additionalBlockedCompanies: z.array(blockedCompanySchema),
    fullName: z.string().optional(),
    shareCompanyPreMatch: z.boolean(),
    shareFullNamePostMatch: z.boolean(),
    sharePhotoPostMatch: z.boolean(),
    phoneNumber: z.string().optional(),
    // Unlike privacyStepSchema above, this settings-page schema requires
    // these explicitly (no default) — PrivacySettingsForm always has the
    // email/phone-reveal toggles and submits real values for both.
    shareEmailPostMatch: z.boolean(),
    sharePhonePostMatch: z.boolean(),
    // See the matching comment on privacyStepSchema above re: which fields
    // are deliberately omitted — no LinkedIn here either now, it moved to
    // the profile-step settings form (updateProfileSettingsAction). No
    // resumeRetentionPreference here either now — the settings-page
    // resume-retention choice was removed entirely; the file is always
    // kept, see resumes/service.ts.
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
  // Blocked companies feed the privacy hard-filter directly, so a change
  // here can open up slots that were previously filtered out — regenerate
  // synchronously, same shared call as updateProfileSettingsAction above.
  await generateSuggestionsForUser(user.id);
  revalidatePath("/app/settings/privacy");
  revalidatePath("/app/matches");
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
  "PROJECT_PITCH",
  "BEHAVIORAL_INTERVIEW",
  "MENTAL_SUPPORT",
  "OTHER",
]);

const preferencesStepSchema = z.object({
  peerMinExperienceMonths: z.number().min(0),
  peerMaxExperienceMonths: z.number().min(0),
  format: z.enum(["ONE_ON_ONE", "GROUP", "BOTH"]),
  cadence: z.enum(["ONE_TIME", "RECURRING", "BOTH"]),
  mode: z.enum(["ONLINE", "IN_PERSON", "BOTH"]),
  genderPreference: z.enum(["MALE", "FEMALE", "BOTH"]).optional(),
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
  redirect("/app/onboarding/overview");
}

export async function confirmOnboardingAction(): Promise<void> {
  const user = await requireUser();
  await activateProfile(user.id);
  // Generate the first batch of suggestions synchronously (same call the
  // manual "Find matches" button uses) so app/matches/page.tsx already has
  // results by the time the user's first click lands there, instead of
  // showing an empty state until the next scheduled matching/job.ts run.
  // The returned count feeds the welcome popup's "X new matches" copy.
  const matchCount = await generateSuggestionsForUser(user.id);
  revalidatePath("/app", "layout");
  redirect(`/app?welcome=1&matches=${matchCount}`);
}

export async function uploadProfilePhotoAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const limited = rateLimit(`profile-photo:upload:${user.id}`, 10, 60 * 60 * 1000);
  if (!limited.allowed) return { ok: false, error: "יותר מדי העלאות. נסו שוב בעוד כשעה" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "לא נבחרה תמונה" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadProfilePhoto(user.id, { filename: file.name, mimeType: file.type, buffer });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/onboarding/privacy");
  revalidatePath("/app/settings/privacy");
  return { ok: true };
}

export async function deleteProfilePhotoAction(): Promise<ActionState> {
  const user = await requireUser();
  await deleteProfilePhoto(user.id);
  revalidatePath("/app/onboarding/privacy");
  revalidatePath("/app/settings/privacy");
  return { ok: true };
}
