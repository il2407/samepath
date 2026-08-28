"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireModerator } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { removeContribution } from "@/modules/moderation/interviews";

export type ActionState = { ok: boolean; error?: string };

const resolveTakedownSchema = z.object({
  takedownId: z.string().min(1),
  status: z.enum(["ACCEPTED", "REJECTED"]),
  resolutionNote: z.string().min(1, "נדרשת הערת סגירה"),
});

/** Accepting a takedown removes the linked interview experience, if any; rejecting only closes the request. */
export async function resolveTakedownAction(input: unknown): Promise<ActionState> {
  const moderator = await requireModerator();
  const parsed = resolveTakedownSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  const takedown = await prisma.takedownRequest.findUniqueOrThrow({ where: { id: parsed.data.takedownId } });

  if (parsed.data.status === "ACCEPTED" && takedown.experienceId) {
    await removeContribution(moderator.id, takedown.experienceId, `takedown accepted: ${parsed.data.resolutionNote}`, false);
  }

  await prisma.takedownRequest.update({
    where: { id: parsed.data.takedownId },
    data: {
      status: parsed.data.status,
      resolvedAt: new Date(),
      resolvedByUserId: moderator.id,
      resolutionNote: parsed.data.resolutionNote,
    },
  });

  revalidatePath("/admin/takedowns");
  revalidatePath("/admin/interview-library");
  return { ok: true };
}
