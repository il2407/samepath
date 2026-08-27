"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { convertCredits } from "@/modules/credits/service";

export type ConvertActionState = { ok: boolean; accessDaysGranted?: number; error?: string };

const errorMessages: Record<string, string> = {
  invalid_tier: "סכום לא תקין",
  insufficient_credits: "אין מספיק קרדיטים",
  window_cap_reached: "הגעתם למכסת ימי הגישה מקרדיטים לתקופה הנוכחית",
};

export async function convertCreditsAction(creditsToSpend: number): Promise<ConvertActionState> {
  const user = await requireUser();
  const result = await convertCredits(user.id, creditsToSpend);
  if (!result.ok) return { ok: false, error: errorMessages[result.reason] };
  revalidatePath("/app/credits");
  return { ok: true, accessDaysGranted: result.accessDaysGranted };
}
