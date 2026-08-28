"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/modules/auth/session";
import { mergeCompanies } from "@/modules/companies/service";

export type ActionState = { ok: boolean; error?: string };

const mergeSchema = z.object({ sourceId: z.string().min(1), targetId: z.string().min(1) });

export async function mergeCompaniesAction(input: unknown): Promise<ActionState> {
  await requireAdmin();
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };
  if (parsed.data.sourceId === parsed.data.targetId) return { ok: false, error: "לא ניתן למזג חברה לתוך עצמה" };

  try {
    await mergeCompanies(parsed.data.sourceId, parsed.data.targetId);
    revalidatePath("/admin/companies");
    return { ok: true };
  } catch {
    return { ok: false, error: "המיזוג נכשל" };
  }
}
