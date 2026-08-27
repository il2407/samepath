"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { rateLimit } from "@/shared/rate-limit";
import {
  saveDraftExperience,
  submitForReview,
  withdrawContribution,
  type CreateExperienceInput,
} from "@/modules/interviews/contributions";
import { submitValidation, reportContent } from "@/modules/interviews/validation";

const stageEnum = z.enum([
  "RECRUITER_SCREEN",
  "TECHNICAL_SCREEN",
  "CODING",
  "SYSTEM_DESIGN",
  "BEHAVIORAL",
  "HIRING_MANAGER",
  "TAKE_HOME",
  "FINAL_ROUND",
  "OTHER",
]);
const formatEnum = z.enum(["ONLINE", "ONSITE", "PAIR_PROGRAMMING", "WRITTEN_EXERCISE", "CONVERSATION", "OTHER"]);
const outcomeEnum = z.enum(["OFFER", "REJECTED", "NO_RESPONSE", "WITHDREW", "IN_PROGRESS"]);

const stageSchema = z.object({
  stage: stageEnum,
  format: formatEnum,
  approxDurationMinutes: z.number().optional(),
  questions: z.array(z.object({ text: z.string().min(1).max(2000), isFollowUp: z.boolean() })),
});

const experienceSchema = z.object({
  companyId: z.string().min(1, "יש לבחור חברה"),
  targetRoleId: z.string().optional(),
  seniorityBandId: z.string().optional(),
  regionId: z.string().optional(),
  periodYear: z.number().min(2015).max(2100),
  periodQuarter: z.number().min(1).max(4),
  processDescription: z.string().min(20, "נא לתאר את התהליך בפירוט (לפחות 20 תווים)").max(4000),
  whatIWishIKnew: z.string().max(2000).optional(),
  difficultyRating: z.number().min(1).max(5).optional(),
  usefulnessRating: z.number().min(1).max(5).optional(),
  outcome: outcomeEnum.optional(),
  outcomeVisible: z.boolean(),
  topicTagIds: z.array(z.string()),
  stages: z.array(stageSchema),
});

export type ActionState = { ok: boolean; error?: string; experienceId?: string };

export async function saveDraftAction(input: unknown, experienceId?: string): Promise<ActionState> {
  const user = await requireUser();
  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  try {
    const id = await saveDraftExperience(user.id, parsed.data as CreateExperienceInput, experienceId);
    revalidatePath("/app/contributions");
    return { ok: true, experienceId: id };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

const attestationSchema = z.object({
  attestedOwnExperience: z.boolean(),
  attestedTruthful: z.boolean(),
  attestedPermitted: z.boolean(),
  attestedNoConfidential: z.boolean(),
  attestedParaphrased: z.boolean(),
});

const submitErrorMessages: Record<string, string> = {
  not_found: "התרומה לא נמצאה",
  invalid_status: "לא ניתן לשלוח תרומה זו כרגע",
  attestation_incomplete: "יש לאשר את כל ההצהרות לפני שליחה",
};

export async function submitContributionAction(experienceId: string, attestationInput: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = attestationSchema.safeParse(attestationInput);
  if (!parsed.success) return { ok: false, error: "יש לאשר את כל ההצהרות" };

  const limited = rateLimit(`contribution:submit:${user.id}`, 5, 24 * 60 * 60 * 1000);
  if (!limited.allowed) return { ok: false, error: "יותר מדי תרומות היום. נסו שוב מחר" };

  const result = await submitForReview(user.id, experienceId, parsed.data);
  if (!result.ok) return { ok: false, error: submitErrorMessages[result.reason] ?? "משהו השתבש" };

  revalidatePath("/app/contributions");
  return { ok: true };
}

export async function withdrawContributionAction(experienceId: string): Promise<ActionState> {
  const user = await requireUser();
  await withdrawContribution(user.id, experienceId);
  revalidatePath("/app/contributions");
  return { ok: true };
}

const validationTypeEnum = z.enum([
  "SIMILAR_QUESTION",
  "RESEMBLES_PROCESS",
  "OUTDATED",
  "DUPLICATE",
  "CONFIDENTIAL_CONCERN",
  "USEFUL",
]);

export async function submitValidationAction(experienceId: string, type: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = validationTypeEnum.safeParse(type);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  const result = await submitValidation(user.id, experienceId, parsed.data);
  if (!result.ok) {
    const messages: Record<string, string> = {
      self_validation: "לא ניתן לאשר תרומה משלכם",
      not_published: "התרומה אינה זמינה",
      rate_limited: "יותר מדי משובים. נסו שוב מאוחר יותר",
      already_submitted: "כבר שלחתם משוב מסוג זה על התרומה הזו",
    };
    return { ok: false, error: messages[result.reason] };
  }
  revalidatePath(`/app/interviews/experiences/${experienceId}`);
  return { ok: true };
}

const reportSchema = z.object({
  experienceId: z.string().min(1),
  reason: z.enum(["PERSONAL_DATA", "CONFIDENTIAL_INFO", "FABRICATED", "DUPLICATE", "OFFENSIVE", "OTHER"]),
  description: z.string().max(2000).optional(),
});

export async function reportContentAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  await reportContent(user.id, parsed.data.experienceId, parsed.data.reason, parsed.data.description);
  return { ok: true };
}
