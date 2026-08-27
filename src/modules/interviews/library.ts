import "server-only";
import { prisma } from "@/shared/db";
import { canShowAggregateStats, recurringTopics } from "@/modules/interviews/aggregation";
import type { InterviewStage } from "@/generated/prisma/client";

/** Lazily promotes anything whose scheduled publication time has arrived. Called at the top of every browse/read path. */
export async function publishDueExperiences(): Promise<void> {
  await prisma.interviewExperience.updateMany({
    where: { status: "SCHEDULED_FOR_PUBLICATION", publishAt: { lte: new Date() } },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
}

// Every query below selects an explicit field list that never includes
// `authorId` — anonymity is enforced by what we ask Prisma for, not by
// stripping fields out afterward.

export interface ExperienceFilters {
  companyId?: string;
  targetRoleId?: string;
  seniorityBandId?: string;
  regionId?: string;
  stage?: InterviewStage;
  topicTagId?: string;
}

export interface PublicExperienceSummary {
  id: string;
  companyName: string;
  targetRole: string | null;
  seniorityBand: string | null;
  region: string | null;
  periodYear: number;
  periodQuarter: number;
  stages: InterviewStage[];
  topics: string[];
  questionCount: number;
  publishedAt: Date | null;
}

export async function browseExperiences(filters: ExperienceFilters, limit = 30): Promise<PublicExperienceSummary[]> {
  await publishDueExperiences();

  const rows = await prisma.interviewExperience.findMany({
    where: {
      status: "PUBLISHED",
      companyId: filters.companyId,
      targetRoleId: filters.targetRoleId,
      seniorityBandId: filters.seniorityBandId,
      regionId: filters.regionId,
      stages: filters.stage ? { some: { stage: filters.stage } } : undefined,
      topics: filters.topicTagId ? { some: { tagId: filters.topicTagId } } : undefined,
    },
    select: {
      id: true,
      periodYear: true,
      periodQuarter: true,
      publishedAt: true,
      company: { select: { canonicalName: true } },
      targetRole: { select: { labelHe: true } },
      seniorityBand: { select: { labelHe: true } },
      region: { select: { labelHe: true } },
      stages: { select: { stage: true } },
      topics: { select: { tag: { select: { labelHe: true } } } },
      questions: { select: { id: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    companyName: row.company.canonicalName,
    targetRole: row.targetRole?.labelHe ?? null,
    seniorityBand: row.seniorityBand?.labelHe ?? null,
    region: row.region?.labelHe ?? null,
    periodYear: row.periodYear,
    periodQuarter: row.periodQuarter,
    stages: row.stages.map((s) => s.stage),
    topics: row.topics.map((t) => t.tag.labelHe),
    questionCount: row.questions.length,
    publishedAt: row.publishedAt,
  }));
}

export interface PublicExperienceDetail extends PublicExperienceSummary {
  processDescription: string;
  whatIWishIKnew: string | null;
  difficultyRating: number | null;
  usefulnessRating: number | null;
  outcome: string | null;
  questions: { id: string; text: string; isFollowUp: boolean; stage: InterviewStage | null }[];
}

export async function getPublicExperienceDetail(experienceId: string): Promise<PublicExperienceDetail | null> {
  await publishDueExperiences();

  const row = await prisma.interviewExperience.findFirst({
    where: { id: experienceId, status: "PUBLISHED" },
    select: {
      id: true,
      periodYear: true,
      periodQuarter: true,
      publishedAt: true,
      processDescription: true,
      whatIWishIKnew: true,
      difficultyRating: true,
      usefulnessRating: true,
      outcome: true,
      outcomeVisible: true,
      company: { select: { canonicalName: true } },
      targetRole: { select: { labelHe: true } },
      seniorityBand: { select: { labelHe: true } },
      region: { select: { labelHe: true } },
      stages: { select: { stage: true } },
      topics: { select: { tag: { select: { labelHe: true } } } },
      questions: {
        select: { id: true, text: true, isFollowUp: true, stage: { select: { stage: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    companyName: row.company.canonicalName,
    targetRole: row.targetRole?.labelHe ?? null,
    seniorityBand: row.seniorityBand?.labelHe ?? null,
    region: row.region?.labelHe ?? null,
    periodYear: row.periodYear,
    periodQuarter: row.periodQuarter,
    stages: row.stages.map((s) => s.stage),
    topics: row.topics.map((t) => t.tag.labelHe),
    questionCount: row.questions.length,
    publishedAt: row.publishedAt,
    processDescription: row.processDescription,
    whatIWishIKnew: row.whatIWishIKnew,
    difficultyRating: row.difficultyRating,
    usefulnessRating: row.usefulnessRating,
    outcome: row.outcomeVisible ? row.outcome : null,
    questions: row.questions.map((q) => ({ id: q.id, text: q.text, isFollowUp: q.isFollowUp, stage: q.stage?.stage ?? null })),
  };
}

export interface CompanyLibrarySummary {
  companyId: string;
  companyName: string;
  totalReports: number;
  latestReportDate: Date | null;
  canShowAggregateStats: boolean;
  commonStages: InterviewStage[];
  recurringTopics: string[];
  recentQuestions: string[];
}

const MIN_QUESTIONS_SHOWN = 15;

export async function getCompanyLibrarySummary(companyId: string): Promise<CompanyLibrarySummary | null> {
  await publishDueExperiences();

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { canonicalName: true } });
  if (!company) return null;

  const experiences = await prisma.interviewExperience.findMany({
    where: { companyId, status: "PUBLISHED" },
    select: {
      authorId: true, // used ONLY to count distinct contributors below — never returned
      publishedAt: true,
      stages: { select: { stage: true } },
      topics: { select: { tagId: true, tag: { select: { labelHe: true } } } },
      questions: { select: { text: true }, orderBy: { order: "asc" } },
    },
    orderBy: { publishedAt: "desc" },
  });

  const independentContributors = new Set(experiences.map((e) => e.authorId)).size;
  const showStats = canShowAggregateStats(independentContributors);

  const stageCounts = new Map<InterviewStage, number>();
  const topicCounts = new Map<string, { labelHe: string; count: number }>();
  for (const experience of experiences) {
    for (const stage of experience.stages) {
      stageCounts.set(stage.stage, (stageCounts.get(stage.stage) ?? 0) + 1);
    }
    for (const topic of experience.topics) {
      const existing = topicCounts.get(topic.tagId);
      topicCounts.set(topic.tagId, { labelHe: topic.tag.labelHe, count: (existing?.count ?? 0) + 1 });
    }
  }

  const commonStages = showStats
    ? [...stageCounts.entries()].sort((a, b) => b[1] - a[1]).map(([stage]) => stage)
    : [];
  const topics = showStats
    ? recurringTopics([...topicCounts.entries()].map(([tagId, v]) => ({ tagId, ...v }))).map((t) => t.labelHe)
    : [];

  return {
    companyId,
    companyName: company.canonicalName,
    totalReports: experiences.length,
    latestReportDate: experiences[0]?.publishedAt ?? null,
    canShowAggregateStats: showStats,
    commonStages,
    recurringTopics: topics,
    recentQuestions: experiences.flatMap((e) => e.questions.map((q) => q.text)).slice(0, MIN_QUESTIONS_SHOWN),
  };
}
