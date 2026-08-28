"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireModerator } from "@/modules/auth/session";
import {
  approveContribution,
  rejectContribution,
  removeContribution,
  requestChanges,
} from "@/modules/moderation/interviews";

export type ActionState = { ok: boolean; error?: string };

export async function approveContributionAction(experienceId: string, publicationDelayDays: number): Promise<ActionState> {
  const moderator = await requireModerator();
  try {
    await approveContribution(moderator.id, experienceId, publicationDelayDays);
    revalidatePath("/admin/contributions");
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }
}

const changesSchema = z.object({ experienceId: z.string().min(1), message: z.string().min(1, "נדרש הסבר קצר") });

export async function requestChangesAction(input: unknown): Promise<ActionState> {
  const moderator = await requireModerator();
  const parsed = changesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await requestChanges(moderator.id, parsed.data.experienceId, parsed.data.message);
  revalidatePath("/admin/contributions");
  return { ok: true };
}

const rejectSchema = z.object({ experienceId: z.string().min(1), notes: z.string().optional() });

export async function rejectContributionAction(input: unknown): Promise<ActionState> {
  const moderator = await requireModerator();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  await rejectContribution(moderator.id, parsed.data.experienceId, parsed.data.notes);
  revalidatePath("/admin/contributions");
  return { ok: true };
}

const removeSchema = z.object({
  experienceId: z.string().min(1),
  reason: z.string().min(1, "נדרשת סיבה"),
  reverseReward: z.boolean(),
});

export async function removeContributionAction(input: unknown): Promise<ActionState> {
  const moderator = await requireModerator();
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await removeContribution(moderator.id, parsed.data.experienceId, parsed.data.reason, parsed.data.reverseReward);
  revalidatePath("/admin/contributions");
  revalidatePath("/admin/interview-library");
  return { ok: true };
}
