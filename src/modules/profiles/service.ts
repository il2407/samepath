import "server-only";
import { prisma } from "@/shared/db";
import { calculateExperienceMonths, deriveSeniorityBandCode } from "@/modules/profiles/experience";
import { resolveCompanyId } from "@/modules/companies/service";
import type {
  BlockedCompanyReason,
  ConnectionCadence,
  ConnectionFormatPreference,
  ConnectionModePreference,
  ConnectionReason,
  DisplayNamePreference,
  ResumeRetentionPreference,
} from "@/generated/prisma/client";

// --- Step 1: professional profile -------------------------------------------------

export interface EmploymentPositionInput {
  companyId?: string | null;
  companyRaw: string;
  title: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
}

export interface ProfileStepOneInput {
  professionalFieldId: string;
  targetRoleIds: string[];
  currentRoleTitle: string;
  regionId: string | null;
  shortIntro: string;
  tagIds: string[];
  languageIds: string[];
  positions: EmploymentPositionInput[];
}

export async function saveProfileStepOne(userId: string, input: ProfileStepOneInput): Promise<void> {
  const currentPosition = input.positions.find((p) => p.isCurrent) ?? null;
  const currentCompanyId = currentPosition?.companyId
    ? await resolveCompanyId(currentPosition.companyId)
    : null;

  const bands = await prisma.seniorityBand.findMany();
  const experienceMonths = calculateExperienceMonths(
    input.positions.map((p) => ({ startDate: p.startDate, endDate: p.isCurrent ? null : p.endDate })),
  );
  const bandCode = deriveSeniorityBandCode(
    experienceMonths,
    bands.map((b) => ({ code: b.code, minMonths: b.minMonths, maxMonths: b.maxMonths })),
  );
  const seniorityBandId = bandCode ? (bands.find((b) => b.code === bandCode)?.id ?? null) : null;

  await prisma.$transaction(async (tx) => {
    const profile = await tx.professionalProfile.upsert({
      where: { userId },
      update: {
        professionalFieldId: input.professionalFieldId,
        currentRoleTitle: input.currentRoleTitle,
        regionId: input.regionId,
        shortIntro: input.shortIntro,
        experienceMonths,
        seniorityBandId,
        currentCompanyId,
        // Changing employer must be re-confirmed — never carry a stale confirmation forward.
        currentCompanyConfirmedAt: null,
        status: "PENDING_PRIVACY",
      },
      create: {
        userId,
        professionalFieldId: input.professionalFieldId,
        currentRoleTitle: input.currentRoleTitle,
        regionId: input.regionId,
        shortIntro: input.shortIntro,
        experienceMonths,
        seniorityBandId,
        currentCompanyId,
        status: "PENDING_PRIVACY",
      },
    });

    await tx.profileTargetRole.deleteMany({ where: { profileId: profile.id } });
    if (input.targetRoleIds.length > 0) {
      await tx.profileTargetRole.createMany({
        data: input.targetRoleIds.map((targetRoleId) => ({ profileId: profile.id, targetRoleId })),
      });
    }

    await tx.profileTag.deleteMany({ where: { profileId: profile.id } });
    if (input.tagIds.length > 0) {
      await tx.profileTag.createMany({ data: input.tagIds.map((tagId) => ({ profileId: profile.id, tagId })) });
    }

    await tx.profileLanguage.deleteMany({ where: { profileId: profile.id } });
    if (input.languageIds.length > 0) {
      await tx.profileLanguage.createMany({
        data: input.languageIds.map((languageId) => ({ profileId: profile.id, languageId })),
      });
    }

    await tx.employmentPosition.deleteMany({ where: { profileId: profile.id } });
    if (input.positions.length > 0) {
      await tx.employmentPosition.createMany({
        data: input.positions.map((p) => ({
          profileId: profile.id,
          companyId: p.companyId ?? null,
          companyRaw: p.companyRaw,
          title: p.title,
          startDate: p.startDate,
          endDate: p.isCurrent ? null : p.endDate,
          isCurrent: p.isCurrent,
          source: "MANUAL" as const,
        })),
      });
    }
  });
}

// --- Step 2: privacy onboarding ---------------------------------------------------

export interface BlockedCompanyInput {
  companyId: string;
  reason: BlockedCompanyReason;
  note?: string;
}

export interface PrivacyStepInput {
  employerConfirmed: boolean;
  blockEntireCorporateGroup: boolean;
  additionalBlockedCompanies: BlockedCompanyInput[];
  preMatchDisplayMode: DisplayNamePreference;
  aliasText?: string;
  firstName?: string;
  fullName?: string;
  shareFullNamePostMatch: boolean;
  sharePhotoPostMatch: boolean;
  shareLinkedInPostMatch: boolean;
  linkedInUrl?: string;
  sharePreciseLocationPostMatch: boolean;
  shareEmailPostMatch: boolean;
  sharePhonePostMatch: boolean;
  phoneNumber?: string;
  resumeRetentionPreference: ResumeRetentionPreference;
}

export async function completePrivacyOnboarding(userId: string, input: PrivacyStepInput): Promise<void> {
  if (!input.employerConfirmed) {
    throw new Error("employer confirmation is required before continuing");
  }

  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });

  await prisma.$transaction(async (tx) => {
    await tx.professionalProfile.update({
      where: { id: profile.id },
      data: {
        currentCompanyConfirmedAt: new Date(),
        resumeRetentionPreference: input.resumeRetentionPreference,
        status: "INCOMPLETE",
      },
    });

    await tx.privacyPreference.upsert({
      where: { profileId: profile.id },
      update: { blockEntireCorporateGroup: input.blockEntireCorporateGroup, onboardingCompletedAt: new Date() },
      create: {
        profileId: profile.id,
        blockEntireCorporateGroup: input.blockEntireCorporateGroup,
        onboardingCompletedAt: new Date(),
      },
    });

    await tx.blockedCompany.deleteMany({ where: { userId } });
    if (input.additionalBlockedCompanies.length > 0) {
      await tx.blockedCompany.createMany({
        data: input.additionalBlockedCompanies.map((b) => ({
          userId,
          companyId: b.companyId,
          reason: b.reason,
          note: b.note,
        })),
      });
    }

    await tx.identityDisclosurePreference.upsert({
      where: { profileId: profile.id },
      update: {
        preMatchDisplayMode: input.preMatchDisplayMode,
        aliasText: input.aliasText,
        firstName: input.firstName,
        fullName: input.fullName,
        shareFullNamePostMatch: input.shareFullNamePostMatch,
        sharePhotoPostMatch: input.sharePhotoPostMatch,
        shareLinkedInPostMatch: input.shareLinkedInPostMatch,
        linkedInUrl: input.linkedInUrl,
        sharePreciseLocationPostMatch: input.sharePreciseLocationPostMatch,
        shareEmailPostMatch: input.shareEmailPostMatch,
        sharePhonePostMatch: input.sharePhonePostMatch,
        phoneNumber: input.phoneNumber,
      },
      create: {
        profileId: profile.id,
        preMatchDisplayMode: input.preMatchDisplayMode,
        aliasText: input.aliasText,
        firstName: input.firstName,
        fullName: input.fullName,
        shareFullNamePostMatch: input.shareFullNamePostMatch,
        sharePhotoPostMatch: input.sharePhotoPostMatch,
        shareLinkedInPostMatch: input.shareLinkedInPostMatch,
        linkedInUrl: input.linkedInUrl,
        sharePreciseLocationPostMatch: input.sharePreciseLocationPostMatch,
        shareEmailPostMatch: input.shareEmailPostMatch,
        sharePhonePostMatch: input.sharePhonePostMatch,
        phoneNumber: input.phoneNumber,
      },
    });

    await tx.userConfirmation.create({
      data: {
        userId,
        type: "EMPLOYER_CONFIRMED",
        payload: { companyId: profile.currentCompanyId },
      },
    });
    await tx.userConfirmation.create({ data: { userId, type: "PRIVACY_ONBOARDING_CONFIRMED" } });
  });
}

// --- Step 3: connection preferences -------------------------------------------------

export interface AvailabilitySlotInput {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface PreferencesStepInput {
  peerMinExperienceMonths: number;
  peerMaxExperienceMonths: number;
  format: ConnectionFormatPreference;
  cadence: ConnectionCadence;
  mode: ConnectionModePreference;
  languageId: string | null;
  timezone: string;
  reasons: ConnectionReason[];
  availability: AvailabilitySlotInput[];
}

export async function completeConnectionPreferences(userId: string, input: PreferencesStepInput): Promise<void> {
  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
  if (!profile.currentCompanyConfirmedAt) {
    throw new Error("the current employer must be confirmed before the profile can be activated");
  }

  await prisma.$transaction(async (tx) => {
    await tx.connectionPreference.upsert({
      where: { profileId: profile.id },
      update: {
        peerMinExperienceMonths: input.peerMinExperienceMonths,
        peerMaxExperienceMonths: input.peerMaxExperienceMonths,
        format: input.format,
        cadence: input.cadence,
        mode: input.mode,
        languageId: input.languageId,
        timezone: input.timezone,
        reasons: input.reasons,
      },
      create: {
        profileId: profile.id,
        peerMinExperienceMonths: input.peerMinExperienceMonths,
        peerMaxExperienceMonths: input.peerMaxExperienceMonths,
        format: input.format,
        cadence: input.cadence,
        mode: input.mode,
        languageId: input.languageId,
        timezone: input.timezone,
        reasons: input.reasons,
      },
    });

    await tx.availabilitySlot.deleteMany({ where: { profileId: profile.id } });
    if (input.availability.length > 0) {
      await tx.availabilitySlot.createMany({
        data: input.availability.map((slot) => ({ profileId: profile.id, ...slot })),
      });
    }

    await tx.professionalProfile.update({ where: { id: profile.id }, data: { status: "ACTIVE" } });
  });
}

// --- Onboarding progress -------------------------------------------------------------

export type OnboardingStep = "profile" | "privacy" | "preferences" | "done";

export async function getOnboardingStep(userId: string): Promise<OnboardingStep> {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: { connectionPreference: true },
  });
  if (!profile || profile.status === "DRAFT") return "profile";
  if (!profile.currentCompanyConfirmedAt) return "privacy";
  if (!profile.connectionPreference || profile.status !== "ACTIVE") return "preferences";
  return "done";
}

export async function pauseProfile(userId: string): Promise<void> {
  await prisma.professionalProfile.update({ where: { userId }, data: { status: "PAUSED" } });
}

export async function resumeProfile(userId: string): Promise<void> {
  await prisma.professionalProfile.update({ where: { userId }, data: { status: "ACTIVE" } });
}
