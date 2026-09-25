"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireModerator } from "@/modules/auth/session";
import { approveUser, blockUser, unblockUser, type UserActionResult } from "@/modules/admin/users";

export type ActionState = { ok: boolean; error?: string };

const userIdSchema = z.string().min(1);

function toState(result: UserActionResult): ActionState {
  if (result.ok) return { ok: true };
  return { ok: false, error: result.reason === "not_found" ? "המשתמש לא נמצא" : "הפעולה לא זמינה במצב הנוכחי" };
}

async function run(userId: unknown, fn: (id: string) => Promise<UserActionResult>): Promise<ActionState> {
  await requireModerator();
  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };
  const result = await fn(parsed.data);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return toState(result);
}

export async function approveUserAction(userId: string): Promise<ActionState> {
  return run(userId, approveUser);
}

export async function blockUserAction(userId: string): Promise<ActionState> {
  return run(userId, blockUser);
}

export async function unblockUserAction(userId: string): Promise<ActionState> {
  return run(userId, unblockUser);
}
