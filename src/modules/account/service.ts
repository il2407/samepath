import "server-only";
import { prisma } from "@/shared/db";
import { getStorage } from "@/shared/storage";
import { logger } from "@/shared/logger";

export async function exportAccountData(userId: string) {
  const [user, profile, payments, accessPasses, contributions, creditLedger, connections, blockedCompanies, blockedUsers] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, createdAt: true, status: true, role: true },
      }),
      prisma.professionalProfile.findUnique({
        where: { userId },
        include: {
          targetRoles: { include: { targetRole: { select: { labelHe: true } } } },
          tags: { include: { tag: { select: { labelHe: true, kind: true } } } },
          employmentPositions: true,
          availabilitySlots: true,
          connectionPreference: true,
          disclosurePreference: true,
          privacyPreference: true,
          currentCompany: { select: { canonicalName: true } },
        },
      }),
      prisma.payment.findMany({ where: { userId } }),
      prisma.accessPass.findMany({ where: { userId } }),
      prisma.interviewExperience.findMany({ where: { authorId: userId } }),
      prisma.creditLedgerEntry.findMany({ where: { userId } }),
      prisma.connection.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
      prisma.blockedCompany.findMany({ where: { userId }, include: { company: { select: { canonicalName: true } } } }),
      prisma.blockedUser.findMany({ where: { userId } }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    profile,
    blockedCompanies,
    blockedUsersCount: blockedUsers.length,
    connectionsCount: connections.length,
    payments,
    accessPasses,
    contributions,
    creditLedger,
  };
}

/**
 * Soft-delete: the account can never log in again (session.ts already
 * refuses DELETED users) and private/contact fields are scrubbed, but we
 * deliberately do NOT cascade-delete published interview-library
 * contributions — they're already anonymous (authorId is never exposed to
 * any client) and removing them would degrade a shared community resource
 * for no privacy benefit. A user who wants a specific contribution gone can
 * withdraw it separately before deleting their account.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });

  // Delete the underlying files before the DB transaction: marking a
  // ResumeUpload DELETED without also removing its bytes from storage would
  // leave the actual resume sitting on disk, silently undermining the same
  // "deleted means deleted" guarantee the resume-confirmation flow makes.
  const resumeUploads = await prisma.resumeUpload.findMany({
    where: { userId, status: { not: "DELETED" } },
    select: { storageKey: true },
  });
  const storage = getStorage();
  for (const upload of resumeUploads) {
    try {
      await storage.delete(upload.storageKey);
    } catch (error) {
      logger.error("failed to delete resume file during account deletion", { userId, error });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });

    if (profile) {
      await tx.identityDisclosurePreference.updateMany({
        where: { profileId: profile.id },
        data: {
          fullName: null,
          phoneNumber: null,
          linkedInUrl: null,
          shareCompanyPreMatch: false,
          shareFullNamePostMatch: false,
          sharePhonePostMatch: false,
          shareLinkedInPostMatch: false,
          sharePreciseLocationPostMatch: false,
          shareEmailPostMatch: false,
        },
      });
      await tx.professionalProfile.update({ where: { id: profile.id }, data: { status: "PAUSED" } });
    }

    await tx.resumeUpload.updateMany({ where: { userId }, data: { status: "DELETED", deletedAt: new Date() } });

    await tx.user.update({ where: { id: userId }, data: { status: "DELETED", deletedAt: new Date() } });
  });
}
