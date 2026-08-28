import "server-only";
import { prisma } from "@/shared/db";
import { checkPrivacy } from "@/modules/privacy/context";
import { checkAndActivateAccessGate } from "@/modules/access-passes/service";
import type { GroupStatus, ReportCategory } from "@/generated/prisma/client";

const VISIBLE_STATUSES: GroupStatus[] = ["OPEN", "FULL"];

/** True only if every per-member privacy check allowed the pair. Never reveals which member, if any, blocked it. */
export function isGroupEligible(memberChecks: { allowed: boolean }[]): boolean {
  return memberChecks.every((c) => c.allowed);
}

async function activeGroupMemberUserIds(groupId: string): Promise<string[]> {
  const members = await prisma.groupMembership.findMany({
    where: { groupId, status: { in: ["APPROVED", "ACTIVE"] } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/**
 * Checks the candidate against every current active member. Runs fresh on
 * every call — a group must never be shown or joined based on a stale
 * eligibility result.
 */
export async function checkGroupEligibility(userId: string, groupId: string): Promise<boolean> {
  const memberIds = await activeGroupMemberUserIds(groupId);
  const checks = await Promise.all(
    memberIds
      .filter((memberId) => memberId !== userId)
      .map((memberId) => checkPrivacy(userId, memberId, { context: "GROUP", contextId: groupId })),
  );
  return isGroupEligible(checks);
}

export interface GroupSummary {
  id: string;
  title: string;
  professionalField: string | null;
  targetRole: string | null;
  seniorityRange: string | null;
  language: string | null;
  timezone: string;
  mode: string;
  schedule: string | null;
  theme: string | null;
  seriesLength: number | null;
  capacityMax: number;
  memberCount: number;
  status: GroupStatus;
  myMembershipStatus: "NONE" | "ACTIVE" | "WAITLISTED" | "LEFT";
}

export async function listEligibleGroups(userId: string): Promise<GroupSummary[]> {
  const groups = await prisma.group.findMany({
    where: { status: { in: VISIBLE_STATUSES } },
    include: {
      professionalField: { select: { labelHe: true } },
      targetRole: { select: { labelHe: true } },
      minSeniorityBand: { select: { labelHe: true } },
      maxSeniorityBand: { select: { labelHe: true } },
      language: { select: { labelHe: true } },
      memberships: { where: { status: { in: ["APPROVED", "ACTIVE"] } } },
      waitlist: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const result: GroupSummary[] = [];
  for (const group of groups) {
    const myMembership = group.memberships.find((m) => m.userId === userId);

    // Already-approved members always see their own group — the eligibility
    // gate is for prospective joiners, not for continuously re-vetting
    // people already properly in it (a fellow member's status can change
    // without revoking access for everyone else).
    if (!myMembership) {
      const eligible = await checkGroupEligibility(userId, group.id);
      if (!eligible) continue; // omit silently — never explain why
    }

    const onWaitlist = group.waitlist.some((w) => w.userId === userId);

    let myMembershipStatus: GroupSummary["myMembershipStatus"] = "NONE";
    if (myMembership) myMembershipStatus = "ACTIVE";
    else if (onWaitlist) myMembershipStatus = "WAITLISTED";

    const seniorityRange =
      group.minSeniorityBand || group.maxSeniorityBand
        ? [group.minSeniorityBand?.labelHe, group.maxSeniorityBand?.labelHe].filter(Boolean).join(" – ")
        : null;

    result.push({
      id: group.id,
      title: group.title,
      professionalField: group.professionalField?.labelHe ?? null,
      targetRole: group.targetRole?.labelHe ?? null,
      seniorityRange,
      language: group.language?.labelHe ?? null,
      timezone: group.timezone,
      mode: group.mode,
      schedule: group.schedule,
      theme: group.theme,
      seriesLength: group.seriesLength,
      capacityMax: group.capacityMax,
      memberCount: group.memberships.length,
      status: group.status,
      myMembershipStatus,
    });
  }
  return result;
}

export type JoinGroupResult = "JOINED" | "WAITLISTED" | "INELIGIBLE" | "ALREADY_MEMBER" | "ACCESS_REQUIRED";

export async function requestToJoinGroup(userId: string, groupId: string): Promise<JoinGroupResult> {
  const existingBeforeCheck = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (existingBeforeCheck && (existingBeforeCheck.status === "APPROVED" || existingBeforeCheck.status === "ACTIVE")) {
    return "ALREADY_MEMBER";
  }

  // Required recheck immediately before joining — privacy/eligibility can
  // have changed since the group was last listed. Deliberately run OUTSIDE
  // the transaction below: checkGroupEligibility uses the shared Prisma
  // client (its own connections), and calling that from inside an
  // interactive transaction can deadlock the connection pool against the
  // transaction's own held connection.
  const eligible = await checkGroupEligibility(userId, groupId);
  if (!eligible) return "INELIGIBLE";

  // Same reasoning as above: run outside the transaction. Joining a group
  // (including the waitlist) is a "join a new group" action the spec gates
  // on active access, same as accepting a new match.
  const hasAccess = await checkAndActivateAccessGate(userId, "FIRST_GROUP_JOIN");
  if (!hasAccess) return "ACCESS_REQUIRED";

  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });

    const existing = await tx.groupMembership.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (existing && (existing.status === "APPROVED" || existing.status === "ACTIVE")) {
      return "ALREADY_MEMBER" as const;
    }

    const memberCount = await tx.groupMembership.count({
      where: { groupId, status: { in: ["APPROVED", "ACTIVE"] } },
    });

    if (memberCount >= group.capacityMax) {
      await tx.groupWaitlistEntry.upsert({
        where: { groupId_userId: { groupId, userId } },
        update: {},
        create: { groupId, userId },
      });
      if (group.status !== "FULL") {
        await tx.group.update({ where: { id: groupId }, data: { status: "FULL" } });
      }
      return "WAITLISTED" as const;
    }

    if (existing) {
      await tx.groupMembership.update({ where: { id: existing.id }, data: { status: "ACTIVE", leftAt: null } });
    } else {
      await tx.groupMembership.create({ data: { groupId, userId, status: "ACTIVE" } });
    }

    const newCount = memberCount + 1;
    if (newCount >= group.capacityMax && group.status !== "FULL") {
      await tx.group.update({ where: { id: groupId }, data: { status: "FULL" } });
    }

    return "JOINED" as const;
  });
}

export async function leaveGroup(userId: string, groupId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const membership = await tx.groupMembership.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (membership && membership.status !== "LEFT") {
      await tx.groupMembership.update({ where: { id: membership.id }, data: { status: "LEFT", leftAt: new Date() } });
    }
    await tx.groupWaitlistEntry.deleteMany({ where: { groupId, userId } });

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (group?.status === "FULL") {
      const memberCount = await tx.groupMembership.count({
        where: { groupId, status: { in: ["APPROVED", "ACTIVE"] } },
      });
      if (memberCount < group.capacityMax) {
        await tx.group.update({ where: { id: groupId }, data: { status: "OPEN" } });
      }
    }
  });
}

export async function reportGroupConcern(
  userId: string,
  groupId: string,
  category: ReportCategory,
  description: string,
): Promise<void> {
  await prisma.report.create({
    data: { reporterId: userId, groupId, category, description },
  });
}

export interface GroupDetail extends GroupSummary {
  guide: { title: string; purpose: string } | null;
}

/** Returns null when the group doesn't exist OR the caller is no longer eligible — same silent-omission rule as the list. */
export async function getGroupDetail(userId: string, groupId: string): Promise<GroupDetail | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      professionalField: { select: { labelHe: true } },
      targetRole: { select: { labelHe: true } },
      minSeniorityBand: { select: { labelHe: true } },
      maxSeniorityBand: { select: { labelHe: true } },
      language: { select: { labelHe: true } },
      memberships: { where: { status: { in: ["APPROVED", "ACTIVE"] } } },
      waitlist: true,
      guide: { select: { title: true, purpose: true } },
    },
  });
  if (!group || !VISIBLE_STATUSES.includes(group.status)) return null;

  const myMembership = group.memberships.find((m) => m.userId === userId);

  // Same rule as listEligibleGroups: an existing member always sees their
  // own group's detail page, even if a fellow member's status has changed.
  if (!myMembership) {
    const eligible = await checkGroupEligibility(userId, groupId);
    if (!eligible) return null;
  }

  const onWaitlist = group.waitlist.some((w) => w.userId === userId);
  let myMembershipStatus: GroupSummary["myMembershipStatus"] = "NONE";
  if (myMembership) myMembershipStatus = "ACTIVE";
  else if (onWaitlist) myMembershipStatus = "WAITLISTED";

  const seniorityRange =
    group.minSeniorityBand || group.maxSeniorityBand
      ? [group.minSeniorityBand?.labelHe, group.maxSeniorityBand?.labelHe].filter(Boolean).join(" – ")
      : null;

  return {
    id: group.id,
    title: group.title,
    professionalField: group.professionalField?.labelHe ?? null,
    targetRole: group.targetRole?.labelHe ?? null,
    seniorityRange,
    language: group.language?.labelHe ?? null,
    timezone: group.timezone,
    mode: group.mode,
    schedule: group.schedule,
    theme: group.theme,
    seriesLength: group.seriesLength,
    capacityMax: group.capacityMax,
    memberCount: group.memberships.length,
    status: group.status,
    myMembershipStatus,
    guide: group.guide,
  };
}
