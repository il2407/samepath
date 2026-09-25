"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";

export type ActionState = { ok: boolean; error?: string };

const createGroupSchema = z.object({
  title: z.string().min(1, "נדרש שם לקבוצה"),
  professionalFieldId: z.string().optional(),
  targetRoleId: z.string().optional(),
  mode: z.enum(["ONLINE", "IN_PERSON"]),
  schedule: z.string().optional(),
  capacityMin: z.number().min(1),
  capacityMax: z.number().min(1),
  theme: z.string().optional(),
  seriesLength: z.number().optional(),
  guideId: z.string().optional(),
});

export async function createGroupAction(input: unknown): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  if (parsed.data.capacityMin > parsed.data.capacityMax) return { ok: false, error: "טווח קיבולת לא תקין" };

  await prisma.group.create({
    data: {
      title: parsed.data.title,
      professionalFieldId: parsed.data.professionalFieldId || undefined,
      targetRoleId: parsed.data.targetRoleId || undefined,
      mode: parsed.data.mode,
      schedule: parsed.data.schedule || undefined,
      capacityMin: parsed.data.capacityMin,
      capacityMax: parsed.data.capacityMax,
      theme: parsed.data.theme || undefined,
      seriesLength: parsed.data.seriesLength,
      guideId: parsed.data.guideId || undefined,
      status: "OPEN",
      createdByUserId: admin.id,
    },
  });

  revalidatePath("/admin/groups");
  revalidatePath("/app/groups");
  return { ok: true };
}

export async function archiveGroupAction(groupId: string): Promise<ActionState> {
  await requireAdmin();
  await prisma.group.update({ where: { id: groupId }, data: { status: "ARCHIVED" } });
  revalidatePath("/admin/groups");
  revalidatePath("/app/groups");
  return { ok: true };
}
