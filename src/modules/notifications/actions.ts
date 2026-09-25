"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { markAllNotificationsRead } from "@/modules/notifications/service";

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidatePath("/app", "layout");
}
