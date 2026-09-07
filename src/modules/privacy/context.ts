import "server-only";
import { prisma } from "@/shared/db";
import { evaluatePrivacy, type EligibilityProfile, type PrivacyCheckResult } from "@/modules/privacy/engine";
import type { PrivacyAuditContext } from "@/generated/prisma/client";

export async function loadEligibilityProfile(userId: string): Promise<EligibilityProfile | null> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.professionalProfile.findUnique({
      where: { userId },
      include: {
        currentCompany: { select: { corporateGroupId: true } },
        privacyPreference: true,
        connectionPreference: true,
        availabilitySlots: true,
      },
    }),
  ]);
  if (!user) return null;

  const [blockedCompanies, blockedUsers, accessExpired] = await Promise.all([
    prisma.blockedCompany.findMany({ where: { userId }, select: { companyId: true } }),
    prisma.blockedUser.findMany({ where: { userId }, select: { blockedUserId: true } }),
    isAccessExpired(userId),
  ]);

  return {
    userId: user.id,
    userStatus: user.status,
    profileStatus: profile?.status ?? "DRAFT",
    emailVerified: !!user.emailVerifiedAt,
    accessExpired,
    currentCompanyId: profile?.currentCompanyId ?? null,
    currentCompanyConfirmed: !!profile?.currentCompanyConfirmedAt,
    currentCompanyCorporateGroupId: profile?.currentCompany?.corporateGroupId ?? null,
    blockEntireCorporateGroup: profile?.privacyPreference?.blockEntireCorporateGroup ?? true,
    blockedCompanyIds: blockedCompanies.map((b) => b.companyId),
    blockedUserIds: blockedUsers.map((b) => b.blockedUserId),
    connectionFormat: profile?.connectionPreference?.format ?? "BOTH",
    timezone: profile?.connectionPreference?.timezone ?? "Asia/Jerusalem",
    gender: profile?.gender ?? null,
    genderPreference: profile?.connectionPreference?.genderPreference ?? "BOTH",
    availability:
      profile?.availabilitySlots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })) ?? [],
  };
}

/**
 * A user with no access pass yet is fully eligible (the free "check whether
 * there's anyone relevant" period before the first activation event). Only
 * a most-recent pass that is itself EXPIRED blocks eligibility.
 */
async function isAccessExpired(userId: string): Promise<boolean> {
  const latest = await prisma.accessPass.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return latest?.status === "EXPIRED";
}

async function hasNeverAgainDecision(fromUserId: string, aboutUserId: string): Promise<boolean> {
  const decision = await prisma.matchDecision.findFirst({
    where: {
      userId: fromUserId,
      decision: "NEVER_AGAIN",
      matchSuggestion: {
        OR: [
          { userAId: fromUserId, userBId: aboutUserId },
          { userAId: aboutUserId, userBId: fromUserId },
        ],
      },
    },
    select: { id: true },
  });
  return !!decision;
}

export interface PrivacyCheckOptions {
  requiredFormat?: "ONE_ON_ONE" | "GROUP";
  context: PrivacyAuditContext;
  contextId?: string;
  /** Set false for high-frequency internal loops (e.g. checking one candidate against every group member). */
  recordAudit?: boolean;
}

/**
 * The single entry point every feature (matching, groups, sessions,
 * connections) must call before showing or acting on a candidate/group/
 * session. Loads both sides fresh from the database — never trust a
 * previously computed result, since employer/privacy settings can change
 * at any time.
 */
export async function checkPrivacy(
  subjectUserId: string,
  candidateUserId: string,
  options: PrivacyCheckOptions,
): Promise<PrivacyCheckResult> {
  const [subject, candidate] = await Promise.all([
    loadEligibilityProfile(subjectUserId),
    loadEligibilityProfile(candidateUserId),
  ]);

  let result: PrivacyCheckResult;
  if (!subject) {
    result = { allowed: false, reasonCode: "subject_ineligible" };
  } else if (!candidate) {
    result = { allowed: false, reasonCode: "candidate_ineligible" };
  } else {
    const [candidateNeverAgainBySubject, subjectNeverAgainByCandidate] = await Promise.all([
      hasNeverAgainDecision(subjectUserId, candidateUserId),
      hasNeverAgainDecision(candidateUserId, subjectUserId),
    ]);
    result = evaluatePrivacy({
      subject,
      candidate,
      candidateNeverAgainBySubject,
      subjectNeverAgainByCandidate,
      requiredFormat: options.requiredFormat,
    });
  }

  if (options.recordAudit !== false) {
    await prisma.privacyDecisionAudit.create({
      data: {
        subjectUserId,
        candidateUserId,
        context: options.context,
        contextId: options.contextId,
        decision: result.allowed ? "ALLOW" : "REJECT",
        reasonCode: result.allowed ? "allowed" : result.reasonCode,
      },
    });
  }

  return result;
}
