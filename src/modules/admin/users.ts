import "server-only";
import type { Prisma, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/shared/db";
import { getStorage } from "@/shared/storage";
import { createNotification } from "@/modules/notifications/service";
import { NOTIFICATION_TYPES } from "@/modules/notifications/types";
import { getMailer } from "@/modules/notifications/mailer";
import { accountApprovedEmail } from "@/modules/notifications/email-templates";

// Account approval + blocking. New registrations land in PENDING_APPROVAL
// (auth/service.ts) and are match-ineligible until approved here; a blocked
// account is SUSPENDED, which getCurrentSession, login and registration all
// refuse. Staff accounts (MODERATOR/ADMIN) are never approved/blocked from
// this screen.

export type UserFilter = "PENDING" | "ACTIVE" | "BLOCKED" | "ALL";

const FILTER_STATUSES: Record<UserFilter, UserStatus[]> = {
  PENDING: ["PENDING_APPROVAL"],
  ACTIVE: ["ACTIVE", "PAUSED"],
  BLOCKED: ["SUSPENDED"],
  ALL: ["PENDING_APPROVAL", "ACTIVE", "PAUSED", "SUSPENDED"],
};

export interface AdminUserRow {
  id: string;
  email: string;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  roleTitle: string | null;
  profileStatus: string | null;
}

export async function listUsersForAdmin(filter: UserFilter, search?: string): Promise<AdminUserRow[]> {
  const where: Prisma.UserWhereInput = {
    role: "MEMBER",
    status: { in: FILTER_STATUSES[filter] },
    ...(search ? { email: { contains: search, mode: "insensitive" } } : {}),
  };
  const users = await prisma.user.findMany({
    where,
    include: { professionalProfile: { select: { currentRoleTitle: true, status: true } } },
    orderBy: { createdAt: filter === "PENDING" ? "asc" : "desc" },
    take: 200,
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    status: u.status,
    emailVerified: u.emailVerifiedAt !== null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    roleTitle: u.professionalProfile?.currentRoleTitle ?? null,
    profileStatus: u.professionalProfile?.status ?? null,
  }));
}

export async function countUsersByFilter(): Promise<Record<UserFilter, number>> {
  const groups = await prisma.user.groupBy({ by: ["status"], where: { role: "MEMBER" }, _count: true });
  const count = (statuses: UserStatus[]) =>
    groups.filter((g) => statuses.includes(g.status)).reduce((sum, g) => sum + g._count, 0);
  return {
    PENDING: count(FILTER_STATUSES.PENDING),
    ACTIVE: count(FILTER_STATUSES.ACTIVE),
    BLOCKED: count(FILTER_STATUSES.BLOCKED),
    ALL: count(FILTER_STATUSES.ALL),
  };
}

export type UserActionResult = { ok: true } | { ok: false; reason: "not_found" | "invalid_state" };

async function loadMember(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "MEMBER") return null;
  return user;
}

/** PENDING_APPROVAL -> ACTIVE, then tells the user in-app and by email. */
export async function approveUser(userId: string): Promise<UserActionResult> {
  const user = await loadMember(userId);
  if (!user) return { ok: false, reason: "not_found" };
  if (user.status !== "PENDING_APPROVAL") return { ok: false, reason: "invalid_state" };

  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  await createNotification(userId, NOTIFICATION_TYPES.ACCOUNT_APPROVED);
  try {
    await getMailer().send({ to: user.email, ...accountApprovedEmail() });
  } catch (error) {
    console.error("[admin/users] failed to email account approval", { userId, error });
  }
  return { ok: true };
}

/**
 * Blocks the account: SUSPENDED + every live session revoked, so the user is
 * signed out immediately and the email can neither log in nor re-register.
 * Open match suggestions are left as-is — the privacy engine already refuses
 * any pair involving a SUSPENDED user.
 */
export async function blockUser(userId: string): Promise<UserActionResult> {
  const user = await loadMember(userId);
  if (!user) return { ok: false, reason: "not_found" };
  if (user.status === "SUSPENDED" || user.status === "DELETED") return { ok: false, reason: "invalid_state" };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } }),
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return { ok: true };
}

/** SUSPENDED -> ACTIVE. Unblocking counts as approved; no notification is sent. */
export async function unblockUser(userId: string): Promise<UserActionResult> {
  const user = await loadMember(userId);
  if (!user) return { ok: false, reason: "not_found" };
  if (user.status !== "SUSPENDED") return { ok: false, reason: "invalid_state" };

  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  return { ok: true };
}

/**
 * Everything an admin needs to decide on a pending account: the full
 * profile (including the real name / LinkedIn / phone the user entered,
 * which no member-facing path ever shows pre-match) plus the uploaded
 * resume files. Staff-only — the page and the resume download route both
 * gate on MODERATOR/ADMIN.
 */
export async function getUserDetailForAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      professionalProfile: {
        include: {
          professionalField: true,
          seniorityBand: true,
          region: true,
          currentCompany: true,
          targetRoles: { include: { targetRole: true } },
          tags: { include: { tag: true } },
          employmentPositions: { include: { company: true }, orderBy: { startDate: "desc" } },
          disclosurePreference: true,
        },
      },
      resumeUploads: { orderBy: { uploadedAt: "desc" } },
      blockedCompanies: { include: { company: true } },
    },
  });
  if (!user || user.role !== "MEMBER") return null;
  return user;
}

export type AdminUserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetailForAdmin>>>;

/** Reads a member's uploaded resume file for staff review. Null if it was deleted or never existed. */
export async function getResumeFileForAdmin(uploadId: string) {
  const upload = await prisma.resumeUpload.findUnique({ where: { id: uploadId } });
  if (!upload || upload.deletedAt || upload.status === "DELETED") return null;
  try {
    const data = await getStorage().get(upload.storageKey);
    return { data, mimeType: upload.mimeType, filename: upload.originalFilename };
  } catch (error) {
    console.error("[admin/users] resume file missing from storage", { uploadId, error });
    return null;
  }
}
