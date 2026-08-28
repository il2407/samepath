"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import type { Prisma } from "@/generated/prisma/client";

export type ActionState = { ok: boolean; error?: string };

const updateSchema = z.object({ key: z.string().min(1), valueJsonText: z.string().min(1) });

export async function updateRewardPolicyAction(input: unknown): Promise<ActionState> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  let value: unknown;
  try {
    value = JSON.parse(parsed.data.valueJsonText);
  } catch {
    return { ok: false, error: "JSON לא תקין" };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "הערך חייב להיות אובייקט JSON" };
  }

  await prisma.rewardPolicy.update({
    where: { key: parsed.data.key },
    data: { valueJson: value as Prisma.InputJsonValue },
  });

  revalidatePath("/admin/reward-policies");
  return { ok: true };
}
