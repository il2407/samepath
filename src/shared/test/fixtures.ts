import { prisma } from "@/shared/db";
import type {
  ConnectionFormatPreference,
  Gender,
  GenderPreference,
  ProfileStatus,
  UserStatus,
} from "@/generated/prisma/client";

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

export interface TestDisclosureOptions {
  fullName?: string;
  shareCompanyPreMatch?: boolean;
  /** Repurposed (backlog item 9/10, see profiles/dto.ts): "reveal first name early, at the mutual-interest stage." */
  shareFullNamePostMatch?: boolean;
  phoneNumber?: string;
  linkedInUrl?: string;
  shareEmailPostMatch?: boolean;
  sharePhonePostMatch?: boolean;
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
  experienceMonths?: number;
  gender?: Gender;
  genderPreference?: GenderPreference;
  /** Identity-disclosure preferences (backlog items 8/9 — WS3) — omitted fields keep their schema defaults (false/null). */
  disclosure?: TestDisclosureOptions;
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
      gender: options.gender,
      privacyPreference: {
        create: { blockEntireCorporateGroup: options.blockEntireCorporateGroup ?? true },
      },
      connectionPreference: {
        create: {
          format: options.connectionFormat ?? "BOTH",
          timezone: options.timezone ?? "Asia/Jerusalem",
          genderPreference: options.genderPreference ?? "BOTH",
        },
      },
      disclosurePreference: {
        create: options.disclosure ?? {},
      },
      availabilitySlots: options.availability
        ? { create: options.availability.map((s) => ({ dayOfWeek: s.dayOfWeek, startMinute: s.startMinute, endMinute: s.endMinute })) }
        : undefined,
      targetRoles: options.targetRoleIds
        ? { create: options.targetRoleIds.map((targetRoleId) => ({ targetRoleId })) }
        : undefined,
      tags: options.tagIds ? { create: options.tagIds.map((tagId) => ({ tagId })) } : undefined,
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

/** Grants a test user an already-active access pass, bypassing the purchase flow. */
export async function grantActiveAccessPass(userId: string, durationDays = 45) {
  return prisma.accessPass.create({
    data: {
      userId,
      status: "ACTIVE",
      durationDays,
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      activationEventType: "MANUAL",
    },
  });
}
