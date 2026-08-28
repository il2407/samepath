"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { leaveGroup, reportGroupConcern, requestToJoinGroup, type JoinGroupResult } from "@/modules/groups/service";

export type ActionState = { ok: boolean; result?: JoinGroupResult; error?: string };

export async function joinGroupAction(groupId: string): Promise<ActionState> {
  const user = await requireUser();
  const result = await requestToJoinGroup(user.id, groupId);
  revalidatePath("/app/groups");
  revalidatePath(`/app/groups/${groupId}`);
  if (result === "INELIGIBLE") {
    return { ok: false, error: "לא ניתן להצטרף לקבוצה זו כרגע" };
  }
  if (result === "ACCESS_REQUIRED") {
    return { ok: false, error: "נדרשת גישה פעילה כדי להצטרף לקבוצה. אפשר להפעיל גישה בעמוד הגישה שלי." };
  }
  return { ok: true, result };
}

export async function leaveGroupAction(groupId: string): Promise<ActionState> {
  const user = await requireUser();
  await leaveGroup(user.id, groupId);
  revalidatePath("/app/groups");
  revalidatePath(`/app/groups/${groupId}`);
  return { ok: true };
}

const reportSchema = z.object({
  groupId: z.string().min(1),
  category: z.enum(["SAFETY_CONCERN", "HARASSMENT", "SPAM", "FAKE_PROFILE", "PRIVACY_CONCERN", "NO_SHOW", "OTHER"]),
  description: z.string().min(1, "נא לפרט").max(2000),
});

export async function reportGroupAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await reportGroupConcern(user.id, parsed.data.groupId, parsed.data.category, parsed.data.description);
  revalidatePath(`/app/groups/${parsed.data.groupId}`);
  return { ok: true };
}
