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
import { loadRawProfileForDto, loadViewerShareCompanyPreMatch } from "@/modules/profiles/dto-loader";
import { toPreMatchDTO, toMidStageDTO, type PreMatchCandidateDTO, type MidStageCandidateDTO } from "@/modules/profiles/dto";
import { generateFriendlyNickname } from "@/modules/profiles/nickname";
import { getAccessStatus } from "@/modules/access-passes/service";
import { createConnectionFromMatch } from "@/modules/connections/service";
import { checkAndActivateAccessGate } from "@/modules/access-passes/service";
import { createNotification, NOTIFICATION_TYPES } from "@/modules/notifications/service";
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
 * The "mid-stage" of progressive disclosure (backlog item 9): both sides
 * already said INTERESTED, but a real Connection doesn't exist yet either
 * because the access-pass gate hasn't cleared (ACCESS_CHECK) or, more
 * transiently, because resolveAccessGateAndActivate hasn't run yet
 * (MUTUALLY_ACCEPTED — normally resolves to ACCESS_CHECK or ACTIVE in the
 * same call, so this status is rarely observed at rest, but is included
 * here for completeness/robustness). Before this backlog item, nothing in
 * the UI ever queried these statuses — a match stuck in ACCESS_CHECK simply
 * vanished from the visible list with no explanation. See
 * getMidStageMatchesForUser below.
 */
const MID_STAGE_STATUSES: MatchStatus[] = ["MUTUALLY_ACCEPTED", "ACCESS_CHECK"];

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
  return (await createSuggestionsForUser(userId)).length;
}

/** Same as generateSuggestionsForUser, but returns the counterpart user id
 * of each newly created suggestion, so the caller can notify both sides. */
async function createSuggestionsForUser(userId: string): Promise<string[]> {
  const subjectProfile = await prisma.professionalProfile.findUnique({ where: { userId } });
  if (!subjectProfile || subjectProfile.status !== "ACTIVE") return [];

  const existingCount = await prisma.matchSuggestion.count({
    where: { OR: [{ userAId: userId }, { userBId: userId }], status: { in: NON_TERMINAL_STATUSES } },
  });
  const slotsAvailable = MAX_ACTIVE_SUGGESTIONS - existingCount;
  if (slotsAvailable <= 0) return [];

  const subjectScoring = await loadScoringProfile(userId);
  if (!subjectScoring) return [];

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
            styleScore: breakdown.styleScore,
            totalScore: breakdown.totalScore,
            weightsVersion: WEIGHTS_VERSION,
          },
        },
      },
    });
  }

  return chosen.map((c) => c.candidateUserId);
}

/** Minimum gap between two on-visit searches for the same user — absorbs
 * rapid reloads without skipping a genuine new visit. */
const VISIT_SEARCH_COOLDOWN_MS = 60 * 1000;
const lastVisitSearch = new Map<string, number>();

/**
 * Runs a fresh suggestion search whenever the user enters the platform (the
 * app layout calls this on every full page load). Any new suggestion gets an
 * in-app NEW_MATCH notification for both sides — the counterpart has a new
 * pending suggestion too. Returns how many were created for this user, so
 * the layout can pop a notice. The cooldown is in-memory, like
 * shared/rate-limit.ts: fine for the single-instance MVP, and the worst case
 * without it is only a redundant search (generation itself is idempotent).
 */
export async function searchNewSuggestionsOnVisit(userId: string): Promise<number> {
  const now = Date.now();
  const last = lastVisitSearch.get(userId);
  if (last && now - last < VISIT_SEARCH_COOLDOWN_MS) return 0;
  lastVisitSearch.set(userId, now);

  const counterpartIds = await createSuggestionsForUser(userId);
  if (counterpartIds.length === 0) return 0;

  await createNotification(userId, NOTIFICATION_TYPES.NEW_MATCH, { newCount: counterpartIds.length });
  for (const counterpartId of counterpartIds) {
    await createNotification(counterpartId, NOTIFICATION_TYPES.NEW_MATCH, { newCount: 1 });
  }
  return counterpartIds.length;
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

  // The viewer's own reciprocal-visibility consent (backlog item 8) — loaded
  // once per call, not per-candidate, since it's the same person viewing
  // every suggestion in this list.
  const viewerShareCompanyPreMatch = await loadViewerShareCompanyPreMatch(userId);

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
      candidate: toPreMatchDTO(raw, viewerShareCompanyPreMatch),
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

export interface MidStageMatchView {
  id: string;
  candidate: MidStageCandidateDTO;
  /** Fallback identity when candidate.firstName is null — same anonymous persona as the pre-match card, seeded from the same suggestion id so it stays stable across the transition. */
  codeName: string;
  matchPercentage: number;
  status: Extract<MatchStatus, "MUTUALLY_ACCEPTED" | "ACCESS_CHECK">;
  /**
   * Only meaningful when status is ACCESS_CHECK: true when it's specifically
   * THIS user (not the other side) who still needs to activate/purchase an
   * access pass before the connection can open. Lets the UI say "it's on
   * you" vs. "waiting on the other person" instead of one generic message.
   */
  viewerNeedsAccessPass: boolean;
}

/**
 * Surfaces the "middle stage" of progressive disclosure (backlog item 9):
 * matches where both sides already said INTERESTED but no real Connection
 * exists yet (MatchStatus MUTUALLY_ACCEPTED/ACCESS_CHECK). Before this
 * function existed, reaching this state was a UI dead end — the suggestion
 * disappeared from getActiveSuggestionsForUser's list (VISIBLE_STATUSES
 * doesn't include these two) and nothing told the user why. Wired up on
 * /app/matches, directly below the pre-match suggestion list.
 *
 * Re-checks privacy fresh, exactly like getActiveSuggestionsForUser, since
 * eligibility can change at any time and this is a real, if narrow, gap in
 * time before a Connection (and its own independent privacy re-check in
 * connections/service.ts) exists.
 */
export async function getMidStageMatchesForUser(userId: string): Promise<MidStageMatchView[]> {
  const suggestions = await prisma.matchSuggestion.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }], status: { in: MID_STAGE_STATUSES } },
    include: { scoreBreakdown: true },
    orderBy: { createdAt: "desc" },
  });
  if (suggestions.length === 0) return [];

  const viewerShareCompanyPreMatch = await loadViewerShareCompanyPreMatch(userId);
  const viewerAccessStatus = await getAccessStatus(userId);
  const viewerNeedsAccessPass = !viewerAccessStatus.hasActivePass && !viewerAccessStatus.pendingPass;

  const result: MidStageMatchView[] = [];
  for (const suggestion of suggestions) {
    const candidateUserId = suggestion.userAId === userId ? suggestion.userBId : suggestion.userAId;

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

    result.push({
      id: suggestion.id,
      candidate: toMidStageDTO(raw, viewerShareCompanyPreMatch),
      codeName: generateFriendlyNickname(suggestion.id),
      matchPercentage: suggestion.scoreBreakdown ? Math.round(suggestion.scoreBreakdown.totalScore * 100) : 0,
      status: suggestion.status as "MUTUALLY_ACCEPTED" | "ACCESS_CHECK",
      viewerNeedsAccessPass: suggestion.status === "ACCESS_CHECK" && viewerNeedsAccessPass,
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
    await Promise.all([
      createNotification(userAId, NOTIFICATION_TYPES.CONNECTION_COMPLETED, { matchSuggestionId }),
      createNotification(userBId, NOTIFICATION_TYPES.CONNECTION_COMPLETED, { matchSuggestionId }),
    ]);
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
