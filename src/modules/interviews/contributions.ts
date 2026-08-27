import "server-only";
import { prisma } from "@/shared/db";
import { scanForProhibitedContent } from "@/modules/interviews/duplicate-detection";
import type { InterviewFormat, InterviewOutcome, InterviewStage } from "@/generated/prisma/client";

export interface StageInput {
  stage: InterviewStage;
  format: InterviewFormat;
  approxDurationMinutes?: number;
  questions: { text: string; isFollowUp: boolean }[];
}

export interface CreateExperienceInput {
  companyId: string;
  targetRoleId?: string;
  seniorityBandId?: string;
  regionId?: string;
  periodYear: number;
  periodQuarter: number;
  processDescription: string;
  whatIWishIKnew?: string;
  difficultyRating?: number;
  usefulnessRating?: number;
  outcome?: InterviewOutcome;
  outcomeVisible?: boolean;
  topicTagIds: string[];
  stages: StageInput[];
}

/** Creates (or overwrites, if editing a still-editable draft) the full experience + stages + questions. */
export async function saveDraftExperience(
  userId: string,
  input: CreateExperienceInput,
  experienceId?: string,
): Promise<string> {
  if (experienceId) {
    const existing = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } });
    if (existing.authorId !== userId) throw new Error("not the author");
    if (existing.status !== "DRAFT" && existing.status !== "NEEDS_CHANGES") {
      throw new Error("this contribution can no longer be edited directly");
    }
  }

  const data = {
    companyId: input.companyId,
    targetRoleId: input.targetRoleId,
    seniorityBandId: input.seniorityBandId,
    regionId: input.regionId,
    periodYear: input.periodYear,
    periodQuarter: input.periodQuarter,
    processDescription: input.processDescription,
    whatIWishIKnew: input.whatIWishIKnew,
    difficultyRating: input.difficultyRating,
    usefulnessRating: input.usefulnessRating,
    outcome: input.outcome,
    outcomeVisible: input.outcomeVisible ?? false,
  };

  const experience = experienceId
    ? await prisma.interviewExperience.update({ where: { id: experienceId }, data })
    : await prisma.interviewExperience.create({ data: { ...data, authorId: userId, status: "DRAFT" } });

  await prisma.interviewExperienceTopic.deleteMany({ where: { experienceId: experience.id } });
  if (input.topicTagIds.length > 0) {
    await prisma.interviewExperienceTopic.createMany({
      data: input.topicTagIds.map((tagId) => ({ experienceId: experience.id, tagId })),
    });
  }

  await prisma.interviewQuestion.deleteMany({ where: { experienceId: experience.id } });
  await prisma.interviewExperienceStage.deleteMany({ where: { experienceId: experience.id } });
  for (const [stageIndex, stageInput] of input.stages.entries()) {
    const stage = await prisma.interviewExperienceStage.create({
      data: {
        experienceId: experience.id,
        stage: stageInput.stage,
        format: stageInput.format,
        approxDurationMinutes: stageInput.approxDurationMinutes,
        order: stageIndex,
      },
    });
    if (stageInput.questions.length > 0) {
      await prisma.interviewQuestion.createMany({
        data: stageInput.questions.map((q, qIndex) => ({
          experienceId: experience.id,
          stageId: stage.id,
          text: q.text,
          isFollowUp: q.isFollowUp,
          order: qIndex,
        })),
      });
    }
  }

  return experience.id;
}

export interface AttestationInput {
  attestedOwnExperience: boolean;
  attestedTruthful: boolean;
  attestedPermitted: boolean;
  attestedNoConfidential: boolean;
  attestedParaphrased: boolean;
}

export type SubmitForReviewResult = { ok: true } | { ok: false; reason: "not_found" | "invalid_status" | "attestation_incomplete" };

export async function submitForReview(
  userId: string,
  experienceId: string,
  attestation: AttestationInput,
): Promise<SubmitForReviewResult> {
  const experience = await prisma.interviewExperience.findUnique({
    where: { id: experienceId },
    include: { questions: true },
  });
  if (!experience || experience.authorId !== userId) return { ok: false, reason: "not_found" };
  if (experience.status !== "DRAFT" && experience.status !== "NEEDS_CHANGES") {
    return { ok: false, reason: "invalid_status" };
  }

  const allAttested = Object.values(attestation).every(Boolean);
  if (!allAttested) return { ok: false, reason: "attestation_incomplete" };

  await prisma.$transaction([
    prisma.contributionAttestation.upsert({
      where: { experienceId },
      update: attestation,
      create: { experienceId, userId, ...attestation },
    }),
    prisma.interviewExperience.update({ where: { id: experienceId }, data: { status: "PENDING_REVIEW" } }),
  ]);

  return { ok: true };
}

export async function withdrawContribution(userId: string, experienceId: string): Promise<void> {
  const experience = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } });
  if (experience.authorId !== userId) throw new Error("not the author");
  await prisma.interviewExperience.update({ where: { id: experienceId }, data: { status: "WITHDRAWN_BY_AUTHOR" } });
}

export async function listMyContributions(userId: string) {
  return prisma.interviewExperience.findMany({
    where: { authorId: userId },
    include: {
      company: { select: { canonicalName: true } },
      questions: true,
      revisionRequests: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyContribution(userId: string, experienceId: string) {
  const experience = await prisma.interviewExperience.findUnique({
    where: { id: experienceId },
    include: {
      stages: { include: { questions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
      topics: { include: { tag: true } },
      revisionRequests: { orderBy: { createdAt: "desc" } },
      company: { select: { id: true, canonicalName: true } },
    },
  });
  if (!experience || experience.authorId !== userId) return null;
  return experience;
}

/** Best-effort, non-blocking content check surfaced to the author before they submit — moderators still review everything regardless. */
export function preSubmitContentWarnings(input: CreateExperienceInput): string[] {
  const texts = [input.processDescription, input.whatIWishIKnew ?? "", ...input.stages.flatMap((s) => s.questions.map((q) => q.text))];
  const warnings = new Set<string>();
  for (const text of texts) {
    const scan = scanForProhibitedContent(text);
    for (const reason of scan.reasons) warnings.add(reason);
  }
  return [...warnings];
}
