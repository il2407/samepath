import "server-only";
import { prisma } from "@/shared/db";

/**
 * Aggregate, non-vanity marketplace-health numbers (spec §12) — no social-
 * feed metrics (no follower counts, streaks, etc.), and privacy-filter
 * activity is reported only as an aggregate count, never broken down by
 * who was rejected or why.
 */
export async function getMarketplaceHealthMetrics() {
  const [
    totalUsers,
    activeProfiles,
    fieldBreakdown,
    totalSuggestions,
    mutuallyAcceptedOrBeyond,
    activeConnections,
    groups,
    usersWithPayment,
    privacyChecks,
    privacyRejections,
    pendingModeration,
    openReports,
    openContentReports,
    openTakedowns,
    pendingUserApprovals,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.professionalProfile.count({ where: { status: "ACTIVE" } }),
    prisma.professionalProfile.groupBy({
      by: ["professionalFieldId"],
      where: { status: "ACTIVE", professionalFieldId: { not: null } },
      _count: true,
    }),
    prisma.matchSuggestion.count(),
    prisma.matchSuggestion.count({
      where: { status: { in: ["MUTUALLY_ACCEPTED", "ACCESS_CHECK", "ACTIVE"] } },
    }),
    prisma.connection.count({ where: { status: "ACTIVE" } }),
    prisma.group.findMany({
      where: { status: { in: ["OPEN", "FULL"] } },
      include: { memberships: { where: { status: { in: ["APPROVED", "ACTIVE"] } } } },
    }),
    prisma.payment.findMany({ where: { status: "PAID" }, distinct: ["userId"], select: { userId: true } }),
    prisma.privacyDecisionAudit.count(),
    prisma.privacyDecisionAudit.count({ where: { decision: "REJECT" } }),
    prisma.interviewExperience.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.contentReport.count({ where: { status: "OPEN" } }),
    prisma.takedownRequest.count({ where: { status: "OPEN" } }),
    prisma.user.count({ where: { status: "PENDING_APPROVAL", role: "MEMBER" } }),
  ]);

  const groupFillRate =
    groups.length === 0
      ? null
      : groups.reduce((sum, g) => sum + g.memberships.length / g.capacityMax, 0) / groups.length;

  return {
    totalUsers,
    activeProfiles,
    fieldBreakdown: fieldBreakdown.map((f) => ({ professionalFieldId: f.professionalFieldId, count: f._count })),
    totalSuggestions,
    mutualAcceptanceRate: totalSuggestions === 0 ? null : mutuallyAcceptedOrBeyond / totalSuggestions,
    activeConnections,
    groupFillRate,
    openGroupsCount: groups.length,
    paidPassConversionRate: totalUsers === 0 ? null : usersWithPayment.length / totalUsers,
    privacyChecksTotal: privacyChecks,
    privacyRejectionRate: privacyChecks === 0 ? null : privacyRejections / privacyChecks,
    pendingModerationCount: pendingModeration,
    openReportsCount: openReports + openContentReports,
    openTakedownsCount: openTakedowns,
    pendingUserApprovals,
  };
}
