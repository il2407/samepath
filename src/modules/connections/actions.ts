"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import {
  blockFromConnection,
  clearConnectionGuide,
  endConnection,
  markMeeting,
  reportConnection,
  selectConnectionGuide,
  sendMessage,
  suggestGuideForConnection,
} from "@/modules/connections/service";
import { PRACTICE_SESSION_CATEGORIES, type PracticeSessionCategorySlug } from "@/modules/guides/service";

export type ActionState = { ok: boolean; error?: string };

export async function sendMessageAction(connectionId: string, body: string): Promise<ActionState> {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "ההודעה ריקה" };
  if (trimmed.length > 4000) return { ok: false, error: "ההודעה ארוכה מדי" };

  try {
    await sendMessage(user.id, connectionId, trimmed);
    revalidatePath(`/app/connections/${connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

const meetingSchema = z.object({
  connectionId: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  note: z.string().max(1000).optional(),
});

export async function markMeetingAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await markMeeting(user.id, parsed.data.connectionId, parsed.data);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

export async function endConnectionAction(connectionId: string): Promise<ActionState> {
  const user = await requireUser();
  await endConnection(user.id, connectionId);
  revalidatePath(`/app/connections/${connectionId}`);
  revalidatePath("/app/connections");
  return { ok: true };
}

export async function blockConnectionAction(connectionId: string, reason?: string): Promise<ActionState> {
  const user = await requireUser();
  await blockFromConnection(user.id, connectionId, reason);
  revalidatePath(`/app/connections/${connectionId}`);
  revalidatePath("/app/connections");
  return { ok: true };
}

const reportSchema = z.object({
  connectionId: z.string().min(1),
  category: z.enum(["SAFETY_CONCERN", "HARASSMENT", "SPAM", "FAKE_PROFILE", "PRIVACY_CONCERN", "NO_SHOW", "OTHER"]),
  description: z.string().min(1, "נא לפרט").max(2000),
});

export async function reportConnectionAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await reportConnection(user.id, parsed.data.connectionId, parsed.data.category, parsed.data.description);
  revalidatePath(`/app/connections/${parsed.data.connectionId}`);
  return { ok: true };
}

const categorySlugs = PRACTICE_SESSION_CATEGORIES.map((c) => c.slug) as [
  PracticeSessionCategorySlug,
  ...PracticeSessionCategorySlug[],
];
const pickGuideSchema = z.object({
  connectionId: z.string().min(1),
  category: z.enum(categorySlugs),
});

/** Picks a random published guide from the category and attaches it to the connection immediately — visible to both participants, still fully optional (can be cleared or re-picked any time). */
export async function pickGuideForConnectionAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = pickGuideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    const guide = await suggestGuideForConnection(user.id, parsed.data.connectionId, parsed.data.category);
    if (!guide) return { ok: false, error: "אין עדיין הצעות בקטגוריה הזו" };

    await selectConnectionGuide(user.id, parsed.data.connectionId, guide.id);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

export async function clearConnectionGuideAction(connectionId: string): Promise<ActionState> {
  const user = await requireUser();
  try {
    await clearConnectionGuide(user.id, connectionId);
    revalidatePath(`/app/connections/${connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}
