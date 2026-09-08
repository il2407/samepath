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
  Gender,
  GenderPreference,
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
  /** Self-reported, optional — used only to evaluate a match's genderPreference. */
  gender?: Gender | null;
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

  const existing = await prisma.professionalProfile.findUnique({ where: { userId } });
  // Only re-confirmation-gate when the employer actually changed. Editing a
  // bio or a skill list later (e.g. from the settings page) must not
  // silently knock an ACTIVE profile back into onboarding.
  const employerChanged = !existing || existing.currentCompanyId !== currentCompanyId;

  await prisma.$transaction(async (tx) => {
    const profile = await tx.professionalProfile.upsert({
      where: { userId },
      update: {
        professionalFieldId: input.professionalFieldId,
        currentRoleTitle: input.currentRoleTitle,
        regionId: input.regionId,
        shortIntro: input.shortIntro,
        gender: input.gender ?? null,
        experienceMonths,
        seniorityBandId,
        currentCompanyId,
        ...(employerChanged
          ? { currentCompanyConfirmedAt: null, status: "PENDING_PRIVACY" as const }
          : {}),
      },
      create: {
        userId,
        professionalFieldId: input.professionalFieldId,
        currentRoleTitle: input.currentRoleTitle,
        regionId: input.regionId,
        shortIntro: input.shortIntro,
        gender: input.gender ?? null,
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

export async function getProfileEditData(userId: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      targetRoles: { select: { targetRoleId: true } },
      tags: { select: { tagId: true } },
      languages: { select: { languageId: true } },
      employmentPositions: {
        include: { company: { select: { id: true, canonicalName: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });
  return profile;
}

// --- Step 2: privacy onboarding ---------------------------------------------------

export interface BlockedCompanyInput {
  companyId: string;
  reason: BlockedCompanyReason;
  note?: string;
}

export interface PrivacyStepInput {
  employerConfirmed: boolean;
  additionalBlockedCompanies: BlockedCompanyInput[];
  fullName?: string;
  shareCompanyPreMatch: boolean;
  /**
   * Repurposed (backlog item 9/10 — see profiles/dto.ts's design note at the
   * top of the file): no longer "reveal my full name once we're fully
   * connected" (that's now automatic at the CONNECTED stage, unconditional).
   * This now means "reveal my first name early, at the mutual-interest
   * stage, before a real connection even exists." Column name kept as-is —
   * no migration — only its meaning and the moment it's consulted changed.
   */
  shareFullNamePostMatch: boolean;
  sharePhotoPostMatch: boolean;
  phoneNumber?: string;
  // Deliberately no blockEntireCorporateGroup here (backlog item 6 —
  // corporate-group blocking was removed from privacy/engine.ts, so this
  // toggle no longer does anything; the column keeps its DB default of
  // `true` forever, never written to `false` by user action again — see
  // completePrivacyOnboarding below).
  //
  // Deliberately no shareLinkedInPostMatch/linkedInUrl here (backlog item
  // 11/12 — LinkedIn is never disclosed, at any stage; see dto.ts).
  //
  // Deliberately no sharePreciseLocationPostMatch/shareEmailPostMatch/
  // sharePhonePostMatch here (backlog item 10 — automatic reveal at the
  // CONNECTED stage replaces these three toggles; see dto.ts's design
  // note). `phoneNumber` above is still collected as data (there's still
  // something to automatically reveal), just no longer gated by its own
  // toggle.
  //
  // Deliberately no resumeRetentionPreference here (removed — see WS1
  // backlog "duplicated résumé-retention controls"): the real decision for
  // any résumé actually uploaded during this onboarding pass is made
  // in-context at draft-confirmation time (ResumeDraftReview's "keep the
  // file" checkbox -> confirmResumeDraft(userId, uploadId, keepFile) in
  // resumes/service.ts), which already ran before a user ever reaches this
  // step. A second, generic "for whenever you upload a resume in the
  // future" control here was confusing (it also showed up for users who
  // never uploaded one at all) and duplicated that decision days later with
  // no new information. The equivalent *default preference for a future
  // upload* still exists as its own, legitimate, standalone setting in
  // account settings (PrivacySettingsForm / updatePrivacySettings below) —
  // that one has a real purpose (there's no in-context draft-review moment
  // to attach it to from Settings) and is intentionally untouched.
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
        status: "INCOMPLETE",
      },
    });

    // blockEntireCorporateGroup is deliberately never written here anymore
    // (backlog item 6) — it keeps its DB default of `true` for every
    // profile, onboarding or not; there is no longer a user action that
    // changes it.
    await tx.privacyPreference.upsert({
      where: { profileId: profile.id },
      update: { onboardingCompletedAt: new Date() },
      create: { profileId: profile.id, onboardingCompletedAt: new Date() },
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

    // shareLinkedInPostMatch/linkedInUrl and
    // sharePreciseLocationPostMatch/shareEmailPostMatch/sharePhonePostMatch
    // are deliberately never written here anymore (backlog items 9-11) —
    // see PrivacyStepInput's comment above. Their DB columns keep whatever
    // value they already have (false/null for a new profile, via schema
    // defaults on create).
    await tx.identityDisclosurePreference.upsert({
      where: { profileId: profile.id },
      update: {
        fullName: input.fullName,
        shareCompanyPreMatch: input.shareCompanyPreMatch,
        shareFullNamePostMatch: input.shareFullNamePostMatch,
        sharePhotoPostMatch: input.sharePhotoPostMatch,
        phoneNumber: input.phoneNumber,
      },
      create: {
        profileId: profile.id,
        fullName: input.fullName,
        shareCompanyPreMatch: input.shareCompanyPreMatch,
        shareFullNamePostMatch: input.shareFullNamePostMatch,
        sharePhotoPostMatch: input.sharePhotoPostMatch,
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

// --- Post-onboarding settings edits ---------------------------------------------------
// Same underlying data as the onboarding steps above, but deliberately
// without their onboarding-specific side effects (resetting profile status,
// writing UserConfirmation rows) — these are for the settings pages, not
// first-time setup.

// Unlike PrivacyStepInput (onboarding), the settings page keeps
// resumeRetentionPreference — see PrivacySettingsForm.tsx's own, separate
// "future resume upload" section, explicitly preserved as-is (it's not a
// duplicate of the onboarding control removed above; it's the only place
// this preference is ever set once a user is past onboarding).
export type PrivacySettingsInput = Omit<PrivacyStepInput, "employerConfirmed"> & {
  resumeRetentionPreference: ResumeRetentionPreference;
};

export async function updatePrivacySettings(userId: string, input: PrivacySettingsInput): Promise<void> {
  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });

  await prisma.$transaction(async (tx) => {
    await tx.professionalProfile.update({
      where: { id: profile.id },
      data: { resumeRetentionPreference: input.resumeRetentionPreference },
    });

    // No privacyPreference write here anymore (backlog item 6):
    // blockEntireCorporateGroup was the only field this settings page ever
    // changed on that row, and it's no longer user-configurable — the row
    // itself was already created during onboarding (completePrivacyOnboarding
    // above), so there's nothing left for this function to upsert.

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

    // See the matching comment in completePrivacyOnboarding above — LinkedIn
    // and the three legacy per-field post-match toggles are deliberately
    // never written here anymore.
    await tx.identityDisclosurePreference.upsert({
      where: { profileId: profile.id },
      update: {
        fullName: input.fullName,
        shareCompanyPreMatch: input.shareCompanyPreMatch,
        shareFullNamePostMatch: input.shareFullNamePostMatch,
        sharePhotoPostMatch: input.sharePhotoPostMatch,
        phoneNumber: input.phoneNumber,
      },
      create: {
        profileId: profile.id,
        fullName: input.fullName,
        shareCompanyPreMatch: input.shareCompanyPreMatch,
        shareFullNamePostMatch: input.shareFullNamePostMatch,
        sharePhotoPostMatch: input.sharePhotoPostMatch,
        phoneNumber: input.phoneNumber,
      },
    });
  });
}

export async function getPrivacySettings(userId: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      privacyPreference: true,
      disclosurePreference: true,
      currentCompany: { select: { canonicalName: true } },
    },
  });
  if (!profile) return null;
  const blockedCompanies = await prisma.blockedCompany.findMany({
    where: { userId },
    include: { company: { select: { id: true, canonicalName: true } } },
  });
  return { profile, blockedCompanies };
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
  /** Who to be matched with, by gender. Defaults to BOTH (no filter). */
  genderPreference?: GenderPreference;
  languageId: string | null;
  timezone: string;
  reasons: ConnectionReason[];
  availability: AvailabilitySlotInput[];
}

export async function completeConnectionPreferences(userId: string, input: PreferencesStepInput): Promise<void> {
  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
  if (!profile.currentCompanyConfirmedAt) {
    throw new Error("the current employer must be confirmed before preferences can be saved");
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
        genderPreference: input.genderPreference ?? "BOTH",
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
        genderPreference: input.genderPreference ?? "BOTH",
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
  });
}

/** Final onboarding step: activates the profile once the user has reviewed the overview page. */
export async function activateProfile(userId: string): Promise<void> {
  const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
  if (!profile.currentCompanyConfirmedAt) {
    throw new Error("the current employer must be confirmed before the profile can be activated");
  }
  const connectionPreference = await prisma.connectionPreference.findUnique({ where: { profileId: profile.id } });
  if (!connectionPreference) {
    throw new Error("connection preferences must be saved before the profile can be activated");
  }

  await prisma.professionalProfile.update({ where: { id: profile.id }, data: { status: "ACTIVE" } });
}

// --- Step 4: overview -----------------------------------------------------------------

export async function getOnboardingOverviewData(userId: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      professionalField: true,
      targetRoles: { include: { targetRole: true } },
      region: true,
      tags: { include: { tag: true } },
      languages: { include: { language: true } },
      employmentPositions: {
        include: { company: { select: { id: true, canonicalName: true } } },
        orderBy: { startDate: "desc" },
      },
      currentCompany: { select: { id: true, canonicalName: true } },
      disclosurePreference: true,
      connectionPreference: { include: { language: true } },
      availabilitySlots: true,
    },
  });
  if (!profile) return null;

  const blockedCompanies = await prisma.blockedCompany.findMany({
    where: { userId },
    include: { company: { select: { id: true, canonicalName: true } } },
  });

  return { profile, blockedCompanies };
}

// --- Onboarding progress -------------------------------------------------------------

export type OnboardingStep = "profile" | "privacy" | "preferences" | "overview" | "done";

export async function getOnboardingStep(userId: string): Promise<OnboardingStep> {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: { connectionPreference: true },
  });
  if (!profile || profile.status === "DRAFT") return "profile";
  if (!profile.currentCompanyConfirmedAt) return "privacy";
  if (!profile.connectionPreference) return "preferences";
  if (profile.status !== "ACTIVE") return "overview";
  return "done";
}

export async function pauseProfile(userId: string): Promise<void> {
  await prisma.professionalProfile.update({ where: { userId }, data: { status: "PAUSED" } });
}

export async function resumeProfile(userId: string): Promise<void> {
  await prisma.professionalProfile.update({ where: { userId }, data: { status: "ACTIVE" } });
}
