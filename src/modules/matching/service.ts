import "server-only";
import { prisma } from "@/shared/db";
import { checkPrivacy } from "@/modules/privacy/context";
import { loadScoringProfile } from "@/modules/matching/context";
import {
  computeScoreBreakdown,
  generateSafeReasons,
  DEFAULT_SCORING_WEIGHTS,
  type SafeReason,
  type ScoreBreakdown,
} from "@/modules/matching/scoring";
import { loadRawProfileForDto } from "@/modules/profiles/dto-loader";
import { toPreMatchDTO, type PreMatchCandidateDTO } from "@/modules/profiles/dto";
import { generateFriendlyNickname } from "@/modules/profiles/nickname";
import { createConnectionFromMatch } from "@/modules/connections/service";
import { checkAndActivateAccessGate } from "@/modules/access-passes/service";
import type { MatchDecisionType, MatchStatus } from "@/generated/prisma/client";

const SUGGESTION_EXPIRY_DAYS = 14;
const MAX_ACTIVE_SUGGESTIONS = 5;
const SUGGESTIONS_TO_GENERATE = 3;
const WEIGHTS_VERSION = "default-v1";

const NON_TERMINAL_STATUSES: MatchStatus[] = [
  "PROPOSED",
  "INTERESTED_BY_A",
  "INTERESTED_BY_B",
  "MUTUALLY_ACCEPTED",
  "PAYMENT_PENDING",
  "ACCESS_CHECK",
];
const VISIBLE_STATUSES: MatchStatus[] = ["PROPOSED", "INTERESTED_BY_A", "INTERESTED_BY_B"];

/**
 * Whether both sides of a mutual match have the access needed to open a
 * connection. Checked (and, where a paid-but-unstarted pass exists,
 * activated) independently per user: whichever side already had an active
 * or pending pass gets it started by this event; a side with no pass at
 * all still needs to purchase before the connection can open.
 */
async function checkAccessGate(userAId: string, userBId: string): Promise<boolean> {
  const [aOk, bOk] = await Promise.all([
    checkAndActivateAccessGate(userAId, "FIRST_MUTUAL_CONNECTION"),
    checkAndActivateAccessGate(userBId, "FIRST_MUTUAL_CONNECTION"),
  ]);
  return aOk && bOk;
}

export async function generateSuggestionsForUser(userId: string): Promise<number> {
  const subjectProfile = await prisma.professionalProfile.findUnique({ where: { userId } });
  if (!subjectProfile || subjectProfile.status !== "ACTIVE") return 0;

  const existingCount = await prisma.matchSuggestion.count({
    where: { OR: [{ userAId: userId }, { userBId: userId }], status: { in: NON_TERMINAL_STATUSES } },
  });
  const slotsAvailable = MAX_ACTIVE_SUGGESTIONS - existingCount;
  if (slotsAvailable <= 0) return 0;

  const subjectScoring = await loadScoringProfile(userId);
  if (!subjectScoring) return 0;

  const candidates = await prisma.professionalProfile.findMany({
    where: { status: "ACTIVE", userId: { not: userId } },
    select: { userId: true },
  });

  const scored: { candidateUserId: string; breakdown: ScoreBreakdown }[] = [];
  for (const candidate of candidates) {
    const existingSuggestion = await prisma.matchSuggestion.findFirst({
      where: {
        status: { in: NON_TERMINAL_STATUSES },
        OR: [
          { userAId: userId, userBId: candidate.userId },
          { userAId: candidate.userId, userBId: userId },
        ],
      },
      select: { id: true },
    });
    if (existingSuggestion) continue;

    const privacyResult = await checkPrivacy(userId, candidate.userId, { context: "MATCH" });
    if (!privacyResult.allowed) continue;

    const candidateScoring = await loadScoringProfile(candidate.userId);
    if (!candidateScoring) continue;

    scored.push({
      candidateUserId: candidate.userId,
      breakdown: computeScoreBreakdown(subjectScoring, candidateScoring, DEFAULT_SCORING_WEIGHTS),
    });
  }

  scored.sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);
  const chosen = scored.slice(0, Math.min(SUGGESTIONS_TO_GENERATE, slotsAvailable));

  for (const { candidateUserId, breakdown } of chosen) {
    const candidateProfile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { userId: candidateUserId },
    });
    await prisma.matchSuggestion.create({
      data: {
        userAId: userId,
        userBId: candidateUserId,
        profileAId: subjectProfile.id,
        profileBId: candidateProfile.id,
        expiresAt: new Date(Date.now() + SUGGESTION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        scoreBreakdown: {
          create: {
            targetRoleScore: breakdown.targetRoleScore,
            fieldScore: breakdown.fieldScore,
            experienceScore: breakdown.experienceScore,
            availabilityScore: breakdown.availabilityScore,
            skillsScore: breakdown.skillsScore,
            languageScore: breakdown.languageScore,
            totalScore: breakdown.totalScore,
            weightsVersion: WEIGHTS_VERSION,
          },
        },
      },
    });
  }

  return chosen.length;
}

export interface SuggestionView {
  id: string;
  candidate: PreMatchCandidateDTO;
  /**
   * System-generated, per-suggestion anonymous persona — never derived from
   * the candidate's real profile data, so it can't leak identity. The same
   * idea as an anonymous collaborator in a shared Google Sheet: a random
   * funny name, seeded from the suggestion itself so it stays stable across
   * refreshes of this same suggestion. The avatar shown alongside it is a
   * DiceBear image derived from this same codeName, computed client-side.
   */
  codeName: string;
  /** Rounded 0-100 compatibility score shown to the user as "X% match". */
  matchPercentage: number;
  reasons: SafeReason[];
  status: MatchStatus;
  myDecision: MatchDecisionType | null;
  waitingOnOther: boolean;
}

export async function getActiveSuggestionsForUser(userId: string): Promise<SuggestionView[]> {
  await prisma.matchSuggestion.updateMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      status: { in: VISIBLE_STATUSES },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED", decidedAt: new Date() },
  });

  const suggestions = await prisma.matchSuggestion.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }], status: { in: VISIBLE_STATUSES } },
    include: { scoreBreakdown: true, decisions: true },
    orderBy: [{ scoreBreakdown: { totalScore: "desc" } }, { createdAt: "desc" }],
  });

  const result: SuggestionView[] = [];
  for (const suggestion of suggestions) {
    const candidateUserId = suggestion.userAId === userId ? suggestion.userBId : suggestion.userAId;

    // Required re-check: privacy/eligibility can change between suggestion
    // creation and the moment it's actually displayed.
    const privacyResult = await checkPrivacy(userId, candidateUserId, {
      context: "MATCH",
      contextId: suggestion.id,
    });
    if (!privacyResult.allowed) {
      await prisma.matchSuggestion.update({
        where: { id: suggestion.id },
        data: { status: "BLOCKED", decidedAt: new Date() },
      });
      continue;
    }

    const raw = await loadRawProfileForDto(candidateUserId);
    if (!raw) continue;

    const myDecision = suggestion.decisions.find((d) => d.userId === userId)?.decision ?? null;
    const otherDecision = suggestion.decisions.find((d) => d.userId === candidateUserId)?.decision ?? null;

    result.push({
      id: suggestion.id,
      candidate: toPreMatchDTO(raw),
      codeName: generateFriendlyNickname(suggestion.id),
      matchPercentage: suggestion.scoreBreakdown ? Math.round(suggestion.scoreBreakdown.totalScore * 100) : 0,
      reasons: suggestion.scoreBreakdown ? generateSafeReasons(suggestion.scoreBreakdown) : [],
      status: suggestion.status,
      myDecision,
      waitingOnOther: myDecision === "INTERESTED" && otherDecision === null,
    });
  }
  return result;
}

export interface RecordDecisionResult {
  status: MatchStatus;
  mutuallyAccepted: boolean;
}

export async function recordMatchDecision(
  userId: string,
  matchSuggestionId: string,
  decision: MatchDecisionType,
  reportDetails?: { category: string; description: string },
): Promise<RecordDecisionResult> {
  const suggestion = await prisma.matchSuggestion.findUniqueOrThrow({ where: { id: matchSuggestionId } });
  if (suggestion.userAId !== userId && suggestion.userBId !== userId) {
    throw new Error("not a participant in this match suggestion");
  }
  if (!NON_TERMINAL_STATUSES.includes(suggestion.status)) {
    return { status: suggestion.status, mutuallyAccepted: false };
  }

  await prisma.matchDecision.upsert({
    where: { matchSuggestionId_userId: { matchSuggestionId, userId } },
    update: { decision },
    create: { matchSuggestionId, userId, decision },
  });

  const otherUserId = suggestion.userAId === userId ? suggestion.userBId : suggestion.userAId;

  if (decision === "REPORT") {
    await prisma.report.create({
      data: {
        reporterId: userId,
        reportedUserId: otherUserId,
        matchSuggestionId,
        category: (reportDetails?.category as never) ?? "OTHER",
        description: reportDetails?.description ?? "",
      },
    });
    await prisma.matchSuggestion.update({
      where: { id: matchSuggestionId },
      data: { status: "REPORTED", decidedAt: new Date() },
    });
    return { status: "REPORTED", mutuallyAccepted: false };
  }

  if (decision === "NOT_NOW" || decision === "NOT_RELEVANT" || decision === "NEVER_AGAIN") {
    await prisma.matchSuggestion.update({
      where: { id: matchSuggestionId },
      data: { status: "DECLINED", decidedAt: new Date() },
    });
    // No notification is ever sent to the other party about a rejection or its reason.
    return { status: "DECLINED", mutuallyAccepted: false };
  }

  // decision === "INTERESTED"
  const otherDecision = await prisma.matchDecision.findUnique({
    where: { matchSuggestionId_userId: { matchSuggestionId, userId: otherUserId } },
  });

  if (otherDecision?.decision === "INTERESTED") {
    const privacyResult = await checkPrivacy(userId, otherUserId, {
      context: "MATCH",
      contextId: matchSuggestionId,
    });
    if (!privacyResult.allowed) {
      await prisma.matchSuggestion.update({
        where: { id: matchSuggestionId },
        data: { status: "BLOCKED", decidedAt: new Date() },
      });
      return { status: "BLOCKED", mutuallyAccepted: false };
    }

    const finalStatus = await activateMutualMatch(matchSuggestionId, suggestion.userAId, suggestion.userBId);
    return { status: finalStatus, mutuallyAccepted: true };
  }

  const newStatus: MatchStatus = suggestion.userAId === userId ? "INTERESTED_BY_A" : "INTERESTED_BY_B";
  await prisma.matchSuggestion.update({ where: { id: matchSuggestionId }, data: { status: newStatus } });
  return { status: newStatus, mutuallyAccepted: false };
}

async function activateMutualMatch(matchSuggestionId: string, userAId: string, userBId: string): Promise<MatchStatus> {
  await prisma.matchSuggestion.update({
    where: { id: matchSuggestionId },
    data: { status: "MUTUALLY_ACCEPTED", decidedAt: new Date() },
  });
  return resolveAccessGateAndActivate(matchSuggestionId, userAId, userBId);
}

async function resolveAccessGateAndActivate(
  matchSuggestionId: string,
  userAId: string,
  userBId: string,
): Promise<MatchStatus> {
  const bothHaveAccess = await checkAccessGate(userAId, userBId);
  const finalStatus: MatchStatus = bothHaveAccess ? "ACTIVE" : "ACCESS_CHECK";

  await prisma.matchSuggestion.update({ where: { id: matchSuggestionId }, data: { status: finalStatus } });
  if (bothHaveAccess) {
    await createConnectionFromMatch(matchSuggestionId, userAId, userBId);
  }

  return finalStatus;
}

/**
 * Re-attempts activation for every suggestion of this user's stuck in
 * ACCESS_CHECK — call right after a purchase completes, since that's
 * exactly the moment the missing side of a pending mutual match might now
 * clear the gate.
 */
export async function retryAccessCheckSuggestionsForUser(userId: string): Promise<void> {
  const stuck = await prisma.matchSuggestion.findMany({
    where: { status: "ACCESS_CHECK", OR: [{ userAId: userId }, { userBId: userId }] },
  });
  for (const suggestion of stuck) {
    await resolveAccessGateAndActivate(suggestion.id, suggestion.userAId, suggestion.userBId);
  }
}
