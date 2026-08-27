import "server-only";
import { prisma } from "@/shared/db";
import { calculateApprovalReward } from "@/modules/credits/rewards";
import { loadRewardPolicy, grantCreditsIdempotent, reverseCreditGrant } from "@/modules/credits/service";
import { scanForProhibitedContent, findLikelyDuplicates } from "@/modules/interviews/duplicate-detection";

const DEFAULT_PUBLICATION_DELAY_DAYS = 14;

export async function listPendingContributions() {
  return prisma.interviewExperience.findMany({
    where: { status: "PENDING_REVIEW" },
    include: {
      company: { select: { canonicalName: true } },
      questions: true,
      attestation: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export interface ModerationQueueItem {
  id: string;
  companyName: string;
  periodYear: number;
  periodQuarter: number;
  processDescription: string;
  questionCount: number;
  contentWarnings: string[];
  likelyDuplicateQuestions: number;
  createdAt: Date;
}

/** Recomputes the automated checks live rather than storing them, keeping the moderation queue simple. */
export async function getModerationQueue(): Promise<ModerationQueueItem[]> {
  const pending = await listPendingContributions();

  const items: ModerationQueueItem[] = [];
  for (const experience of pending) {
    const otherPublishedQuestions = await prisma.interviewQuestion.findMany({
      where: { experience: { companyId: experience.companyId, status: "PUBLISHED" } },
      select: { text: true },
    });
    const existingTexts = otherPublishedQuestions.map((q) => q.text);

    const warnings = new Set<string>();
    let duplicateCount = 0;
    const texts = [experience.processDescription, experience.whatIWishIKnew ?? "", ...experience.questions.map((q) => q.text)];
    for (const text of texts) {
      const scan = scanForProhibitedContent(text);
      for (const reason of scan.reasons) warnings.add(reason);
    }
    for (const question of experience.questions) {
      if (findLikelyDuplicates(question.text, existingTexts).length > 0) duplicateCount += 1;
    }

    items.push({
      id: experience.id,
      companyName: experience.company.canonicalName,
      periodYear: experience.periodYear,
      periodQuarter: experience.periodQuarter,
      processDescription: experience.processDescription,
      questionCount: experience.questions.length,
      contentWarnings: [...warnings],
      likelyDuplicateQuestions: duplicateCount,
      createdAt: experience.createdAt,
    });
  }
  return items;
}

export async function approveContribution(
  moderatorId: string,
  experienceId: string,
  publicationDelayDays: number = DEFAULT_PUBLICATION_DELAY_DAYS,
): Promise<void> {
  const experience = await prisma.interviewExperience.findUniqueOrThrow({
    where: { id: experienceId },
    include: { questions: true },
  });
  if (experience.status !== "PENDING_REVIEW") throw new Error("contribution is not pending review");

  const publishAt = new Date(Date.now() + publicationDelayDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.interviewExperience.update({
      where: { id: experienceId },
      data: { status: "SCHEDULED_FOR_PUBLICATION", publishAt },
    }),
    prisma.contributionReview.create({ data: { experienceId, moderatorId, action: "APPROVE" } }),
  ]);

  const policy = await loadRewardPolicy();
  const reward = calculateApprovalReward(
    { isComplete: experience.processDescription.trim().length > 0, questionCount: experience.questions.length },
    policy,
  );
  if (reward > 0) {
    await grantCreditsIdempotent(experience.authorId, reward, "CONTRIBUTION_APPROVED", `approval:${experienceId}`, experienceId);
  }
}

export async function requestChanges(moderatorId: string, experienceId: string, message: string): Promise<void> {
  const experience = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } });
  if (experience.status !== "PENDING_REVIEW") throw new Error("contribution is not pending review");

  await prisma.$transaction([
    prisma.interviewExperience.update({ where: { id: experienceId }, data: { status: "NEEDS_CHANGES" } }),
    prisma.contributionReview.create({ data: { experienceId, moderatorId, action: "REQUEST_CHANGES" } }),
    prisma.contributionRevisionRequest.create({ data: { experienceId, moderatorId, message } }),
  ]);
}

export async function rejectContribution(moderatorId: string, experienceId: string, notes?: string): Promise<void> {
  const experience = await prisma.interviewExperience.findUniqueOrThrow({ where: { id: experienceId } });
  if (experience.status !== "PENDING_REVIEW") throw new Error("contribution is not pending review");

  await prisma.$transaction([
    prisma.interviewExperience.update({ where: { id: experienceId }, data: { status: "REJECTED" } }),
    prisma.contributionReview.create({ data: { experienceId, moderatorId, action: "REJECT", notes } }),
  ]);
}

/** For fraud/duplication/serious policy violations — reverses any reward already granted. Never for a routine takedown of otherwise-fine content. */
export async function removeContribution(
  moderatorId: string,
  experienceId: string,
  reason: string,
  reverseReward: boolean,
): Promise<void> {
  await prisma.$transaction([
    prisma.interviewExperience.update({ where: { id: experienceId }, data: { status: "REMOVED" } }),
    prisma.contributionReview.create({ data: { experienceId, moderatorId, action: "REMOVE", notes: reason } }),
  ]);

  if (reverseReward) {
    const originalGrant = await prisma.creditLedgerEntry.findFirst({
      where: { sourceExperienceId: experienceId, reason: "CONTRIBUTION_APPROVED" },
    });
    if (originalGrant) await reverseCreditGrant(originalGrant.id);
  }
}

/** Immediately unpublishes while a sensitive report is reviewed, without deciding the final outcome yet. */
export async function unpublishForReview(moderatorId: string, experienceId: string, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.interviewExperience.update({ where: { id: experienceId }, data: { status: "PENDING_REVIEW" } }),
    prisma.moderationAction.create({
      data: { targetType: "INTERVIEW_EXPERIENCE", targetId: experienceId, moderatorId, action: "UNPUBLISH_FOR_REVIEW", reason },
    }),
  ]);
}

export async function listContentReports(status: "OPEN" | "REVIEWING" = "OPEN") {
  return prisma.contentReport.findMany({
    where: { status },
    include: { experience: { include: { company: { select: { canonicalName: true } } } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function resolveContentReport(moderatorId: string, reportId: string, resolution: string): Promise<void> {
  await prisma.$transaction([
    prisma.contentReport.update({ where: { id: reportId }, data: { status: "RESOLVED", resolvedAt: new Date() } }),
    prisma.moderationAction.create({
      data: {
        targetType: "CONTENT_REPORT",
        targetId: reportId,
        moderatorId,
        action: "RESOLVE",
        reason: resolution,
      },
    }),
  ]);
}
