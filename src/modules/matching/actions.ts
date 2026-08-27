"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { generateSuggestionsForUser, recordMatchDecision } from "@/modules/matching/service";

export async function refreshSuggestionsAction(): Promise<{ created: number }> {
  const user = await requireUser();
  const created = await generateSuggestionsForUser(user.id);
  revalidatePath("/app/matches");
  return { created };
}

const decisionSchema = z.object({
  matchSuggestionId: z.string().min(1),
  decision: z.enum(["INTERESTED", "NOT_NOW", "NOT_RELEVANT", "NEVER_AGAIN", "REPORT"]),
  reportCategory: z
    .enum(["SAFETY_CONCERN", "HARASSMENT", "SPAM", "FAKE_PROFILE", "PRIVACY_CONCERN", "NO_SHOW", "OTHER"])
    .optional(),
  reportDescription: z.string().max(2000).optional(),
});

export type DecisionState = { ok: boolean; mutuallyAccepted?: boolean; error?: string };

export async function submitMatchDecisionAction(input: unknown): Promise<DecisionState> {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    const result = await recordMatchDecision(user.id, parsed.data.matchSuggestionId, parsed.data.decision, {
      category: parsed.data.reportCategory ?? "OTHER",
      description: parsed.data.reportDescription ?? "",
    });
    revalidatePath("/app/matches");
    revalidatePath("/app/connections");
    return { ok: true, mutuallyAccepted: result.mutuallyAccepted };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}
