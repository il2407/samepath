import "server-only";
import { prisma } from "@/shared/db";
import { rateLimit } from "@/shared/rate-limit";
import { publishDueExperiences } from "@/modules/interviews/library";
import { Prisma, type ValidationType } from "@/generated/prisma/client";

export type SubmitValidationResult = { ok: true } | { ok: false; reason: "self_validation" | "not_published" | "rate_limited" | "already_submitted" };

export async function submitValidation(
  userId: string,
  experienceId: string,
  type: ValidationType,
): Promise<SubmitValidationResult> {
  await publishDueExperiences();

  const experience = await prisma.interviewExperience.findUnique({ where: { id: experienceId } });
  if (!experience || experience.status !== "PUBLISHED") return { ok: false, reason: "not_published" };
  if (experience.authorId === userId) return { ok: false, reason: "self_validation" };

  const limited = await rateLimit(`validation:${userId}`, 30, 60 * 60 * 1000);
  if (!limited.allowed) return { ok: false, reason: "rate_limited" };

  try {
    await prisma.contributionValidation.create({ data: { experienceId, userId, type } });
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "already_submitted" };
    }
    throw error;
  }
}

export async function reportContent(
  userId: string,
  experienceId: string,
  reason: "PERSONAL_DATA" | "CONFIDENTIAL_INFO" | "FABRICATED" | "DUPLICATE" | "OFFENSIVE" | "OTHER",
  description?: string,
): Promise<void> {
  await prisma.contentReport.create({ data: { experienceId, reporterId: userId, reason, description } });
}
