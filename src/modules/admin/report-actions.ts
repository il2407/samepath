"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireModerator } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { resolveContentReport, unpublishForReview } from "@/modules/moderation/interviews";

export type ActionState = { ok: boolean; error?: string };

const resolveUserReportSchema = z.object({
  reportId: z.string().min(1),
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolutionNote: z.string().min(1, "נדרשת הערת סגירה"),
});

export async function resolveUserReportAction(input: unknown): Promise<ActionState> {
  const moderator = await requireModerator();
  const parsed = resolveUserReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await prisma.report.update({
    where: { id: parsed.data.reportId },
    data: {
      status: parsed.data.status,
      resolvedAt: new Date(),
      resolvedByUserId: moderator.id,
      resolutionNote: parsed.data.resolutionNote,
    },
  });
  revalidatePath("/admin/reports");
  return { ok: true };
}

const resolveContentReportSchema = z.object({
  reportId: z.string().min(1),
  resolution: z.string().min(1, "נדרשת הערת סגירה"),
});

export async function resolveContentReportAction(input: unknown): Promise<ActionState> {
  const moderator = await requireModerator();
  const parsed = resolveContentReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await resolveContentReport(moderator.id, parsed.data.reportId, parsed.data.resolution);
  revalidatePath("/admin/reports");
  return { ok: true };
}

const unpublishSchema = z.object({
  experienceId: z.string().min(1),
  reason: z.string().min(1, "נדרשת סיבה"),
});

export async function unpublishExperienceForReviewAction(input: unknown): Promise<ActionState> {
  const moderator = await requireModerator();
  const parsed = unpublishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  await unpublishForReview(moderator.id, parsed.data.experienceId, parsed.data.reason);
  revalidatePath("/admin/reports");
  revalidatePath("/admin/contributions");
  revalidatePath("/admin/interview-library");
  return { ok: true };
}
