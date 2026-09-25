"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import {
  createGroupByUser,
  leaveGroup,
  reportGroupConcern,
  requestToJoinGroup,
  type CreateGroupInput,
  type JoinGroupResult,
} from "@/modules/groups/service";

export type ActionState = { ok: boolean; result?: JoinGroupResult; error?: string };

export async function joinGroupAction(groupId: string): Promise<ActionState> {
  const user = await requireUser();
  const result = await requestToJoinGroup(user.id, groupId);
  revalidatePath("/app/groups");
  revalidatePath(`/app/groups/${groupId}`);
  revalidatePath("/app/matches");
  if (result === "INELIGIBLE") {
    return { ok: false, error: "הקבוצה הזו כבר לא רלוונטית עבורך" };
  }
  if (result === "ACCESS_REQUIRED") {
    return { ok: false, error: "נדרשת גישה פעילה כדי להצטרף לקבוצה. אפשר להפעיל גישה בעמוד התוכנית שלי." };
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

const createGroupSchema = z.object({
  mode: z.enum(["ONLINE", "IN_PERSON"]),
  location: z.string().max(200).optional(),
  schedule: z.string().max(200).optional(),
  theme: z.string().min(1, "נא לפרט נושא ללמידה").max(200),
});

export type CreateGroupActionState = { ok: boolean; groupId?: string; error?: string };

export async function createUserGroupAction(input: unknown): Promise<CreateGroupActionState> {
  const user = await requireUser();
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  const data: CreateGroupInput = parsed.data;
  const group = await createGroupByUser(user.id, data);
  revalidatePath("/app/groups");
  revalidatePath("/app/matches");
  return { ok: true, groupId: group.id };
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
