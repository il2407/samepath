"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";

export type ActionState = { ok: boolean; error?: string };

const stepSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  kind: z.enum(["AGENDA", "PROMPT", "FOLLOWUP"]),
  role: z.enum(["PRESENTER", "LISTENER", "BOTH"]).default("BOTH"),
  durationMinutes: z.number().min(0).max(180).optional(),
});

const createGuideSchema = z.object({
  title: z.string().min(1, "נדרש כותרת"),
  purpose: z.string().min(1, "נדרשת מטרה"),
  suggestedDurationMinutes: z.number().min(1),
  format: z.enum(["ONE_ON_ONE", "GROUP", "BOTH"]),
  category: z.string().optional(),
  publish: z.boolean(),
  steps: z.array(stepSchema),
});

export async function createGuideAction(input: unknown): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = createGuideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await prisma.sessionGuide.create({
    data: {
      title: parsed.data.title,
      purpose: parsed.data.purpose,
      suggestedDurationMinutes: parsed.data.suggestedDurationMinutes,
      format: parsed.data.format,
      category: parsed.data.category || undefined,
      status: parsed.data.publish ? "PUBLISHED" : "DRAFT",
      createdByUserId: admin.id,
      steps: { create: parsed.data.steps.map((s, index) => ({ ...s, order: index })) },
    },
  });

  revalidatePath("/admin/guides");
  revalidatePath("/app/guides");
  return { ok: true };
}

export async function setGuideStatusAction(guideId: string, status: "PUBLISHED" | "ARCHIVED" | "DRAFT"): Promise<ActionState> {
  await requireAdmin();
  await prisma.sessionGuide.update({ where: { id: guideId }, data: { status } });
  revalidatePath("/admin/guides");
  revalidatePath("/app/guides");
  return { ok: true };
}
