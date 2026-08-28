"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { destroyCurrentSession } from "@/modules/auth/session";
import { pauseProfile, resumeProfile } from "@/modules/profiles/service";
import { deleteAccount } from "@/modules/account/service";

export type ActionState = { ok: boolean; error?: string };

export async function pauseProfileAction(): Promise<ActionState> {
  const user = await requireUser();
  await pauseProfile(user.id);
  revalidatePath("/app/settings/account");
  return { ok: true };
}

export async function resumeProfileAction(): Promise<ActionState> {
  const user = await requireUser();
  await resumeProfile(user.id);
  revalidatePath("/app/settings/account");
  return { ok: true };
}

export async function deleteAccountAction(): Promise<void> {
  const user = await requireUser();
  await deleteAccount(user.id);
  await destroyCurrentSession();
  redirect("/");
}
