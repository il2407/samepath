"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { grantReplacementAccessPass } from "@/modules/access-passes/service";

export type ActionState = { ok: boolean; error?: string };

const productSchema = z.object({
  key: z.string().min(1, "נדרש מפתח"),
  name: z.string().min(1, "נדרש שם"),
  priceCents: z.number().min(0),
  accessDurationDays: z.number().min(1),
  isActive: z.boolean(),
});

export async function createProductConfigAction(input: unknown): Promise<ActionState> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  const existing = await prisma.productConfiguration.findUnique({ where: { key: parsed.data.key } });
  if (existing) return { ok: false, error: "מפתח כבר קיים" };

  await prisma.productConfiguration.create({ data: parsed.data });
  revalidatePath("/admin/access");
  return { ok: true };
}

const updateSchema = productSchema.omit({ key: true }).extend({ id: z.string().min(1) });

export async function updateProductConfigAction(input: unknown): Promise<ActionState> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await prisma.productConfiguration.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      priceCents: parsed.data.priceCents,
      accessDurationDays: parsed.data.accessDurationDays,
      isActive: parsed.data.isActive,
    },
  });
  revalidatePath("/admin/access");
  return { ok: true };
}

const grantSchema = z.object({
  userEmail: z.string().email("נדרש אימייל תקין"),
  reason: z.string().min(1, "נדרשת סיבה"),
  extraDays: z.number().min(1),
});

export async function grantReplacementPassAction(input: unknown): Promise<ActionState> {
  await requireAdmin();
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.userEmail.toLowerCase() } });
  if (!user) return { ok: false, error: "לא נמצא משתמש עם אימייל זה" };

  await grantReplacementAccessPass(user.id, parsed.data.reason, parsed.data.extraDays);
  revalidatePath("/admin/access");
  return { ok: true };
}
