import { prisma } from "@/shared/db";
import type { ConnectionFormatPreference, ProfileStatus, UserStatus } from "@/generated/prisma/client";

interface AvailabilitySlotInput {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

let counter = 0;
function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

export interface TestUserOptions {
  email?: string;
  userStatus?: UserStatus;
  profileStatus?: ProfileStatus;
  companyId?: string;
  companyConfirmed?: boolean;
  blockEntireCorporateGroup?: boolean;
  connectionFormat?: ConnectionFormatPreference;
  timezone?: string;
  availability?: AvailabilitySlotInput[];
  blockedCompanyIds?: string[];
  blockedUserIds?: string[];
  professionalFieldId?: string;
  targetRoleIds?: string[];
  tagIds?: string[];
  languageIds?: string[];
  experienceMonths?: number;
  aliasText?: string;
}

/** Creates a User + ProfessionalProfile (with privacy/connection prefs) ready for domain tests. */
export async function createTestUser(options: TestUserOptions = {}) {
  const user = await prisma.user.create({
    data: {
      email: options.email ?? uniqueEmail("test-user"),
      emailVerifiedAt: new Date(),
      status: options.userStatus ?? "ACTIVE",
    },
  });

  const profile = await prisma.professionalProfile.create({
    data: {
      userId: user.id,
      status: options.profileStatus ?? "ACTIVE",
      currentCompanyId: options.companyId,
      currentCompanyConfirmedAt: options.companyConfirmed ? new Date() : undefined,
      professionalFieldId: options.professionalFieldId,
      experienceMonths: options.experienceMonths ?? 0,
      privacyPreference: {
        create: { blockEntireCorporateGroup: options.blockEntireCorporateGroup ?? true },
      },
      connectionPreference: {
        create: {
          format: options.connectionFormat ?? "BOTH",
          timezone: options.timezone ?? "Asia/Jerusalem",
        },
      },
      disclosurePreference: {
        create: { preMatchDisplayMode: "ALIAS", aliasText: options.aliasText ?? "מ." },
      },
      availabilitySlots: options.availability
        ? { create: options.availability.map((s) => ({ dayOfWeek: s.dayOfWeek, startMinute: s.startMinute, endMinute: s.endMinute })) }
        : undefined,
      targetRoles: options.targetRoleIds
        ? { create: options.targetRoleIds.map((targetRoleId) => ({ targetRoleId })) }
        : undefined,
      tags: options.tagIds ? { create: options.tagIds.map((tagId) => ({ tagId })) } : undefined,
      languages: options.languageIds
        ? { create: options.languageIds.map((languageId) => ({ languageId })) }
        : undefined,
    },
  });

  if (options.blockedCompanyIds) {
    await prisma.blockedCompany.createMany({
      data: options.blockedCompanyIds.map((companyId) => ({
        userId: user.id,
        companyId,
        reason: "OTHER" as const,
      })),
    });
  }
  if (options.blockedUserIds) {
    await prisma.blockedUser.createMany({
      data: options.blockedUserIds.map((blockedUserId) => ({ userId: user.id, blockedUserId })),
    });
  }

  return { user, profile };
}

export async function createTestCompany(canonicalName: string, corporateGroupId?: string) {
  return prisma.company.create({ data: { canonicalName, corporateGroupId } });
}
