import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { prisma } from "@/shared/db";
import {
  completeConnectionPreferences,
  completePrivacyOnboarding,
  getOnboardingStep,
  saveProfileStepOne,
} from "@/modules/profiles/service";

beforeEach(async () => {
  await resetTestDatabase();
});

async function seedRefs() {
  const field = await prisma.professionalField.create({ data: { code: "software-engineering", labelHe: "x", labelEn: "Software Engineering" } });
  const role = await prisma.targetRole.create({
    data: { code: "backend-developer", professionalFieldId: field.id, labelHe: "x", labelEn: "Backend Developer" },
  });
  await prisma.seniorityBand.createMany({
    data: [
      { code: "junior", labelHe: "x", labelEn: "Junior", minMonths: 0, maxMonths: 23 },
      { code: "mid", labelHe: "x", labelEn: "Mid", minMonths: 24, maxMonths: 59 },
      { code: "senior", labelHe: "x", labelEn: "Senior", minMonths: 60, maxMonths: 95 },
    ],
  });
  const skill = await prisma.tag.create({ data: { kind: "SKILL", slug: "typescript", labelHe: "x", labelEn: "TypeScript" } });
  const language = await prisma.language.create({ data: { code: "he", labelHe: "עברית", labelEn: "Hebrew" } });
  const region = await prisma.region.create({ data: { code: "il-center", labelHe: "מרכז", labelEn: "Center", kind: "BROAD_AREA" } });
  return { field, role, skill, language, region };
}

describe("saveProfileStepOne", () => {
  it("computes experience months/band and sets the current company from the current position", async () => {
    const { field, role, skill, language, region } = await seedRefs();
    const company = await prisma.company.create({ data: { canonicalName: "Acme" } });
    const user = await prisma.user.create({ data: { email: "a@example.com" } });

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    await saveProfileStepOne(user.id, {
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      currentRoleTitle: "Backend Engineer",
      regionId: region.id,
      shortIntro: "Building things.",
      tagIds: [skill.id],
      languageIds: [language.id],
      positions: [
        {
          companyId: company.id,
          companyRaw: "Acme",
          title: "Backend Engineer",
          startDate: threeYearsAgo,
          endDate: null,
          isCurrent: true,
        },
      ],
    });

    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: { targetRoles: true, tags: true, languages: true, seniorityBand: true },
    });
    expect(profile.status).toBe("PENDING_PRIVACY");
    expect(profile.currentCompanyId).toBe(company.id);
    expect(profile.currentCompanyConfirmedAt).toBeNull();
    expect(profile.experienceMonths).toBeGreaterThanOrEqual(35);
    expect(profile.seniorityBand?.code).toBe("mid");
    expect(profile.targetRoles).toHaveLength(1);
    expect(profile.tags).toHaveLength(1);
    expect(profile.languages).toHaveLength(1);
  });

  it("resets currentCompanyConfirmedAt when the employer is changed on a later edit", async () => {
    const { field, role, region } = await seedRefs();
    const companyA = await prisma.company.create({ data: { canonicalName: "Acme" } });
    const companyB = await prisma.company.create({ data: { canonicalName: "Globex" } });
    const user = await prisma.user.create({ data: { email: "b@example.com" } });

    const base = {
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      currentRoleTitle: "Engineer",
      regionId: region.id,
      shortIntro: "x",
      tagIds: [],
      languageIds: [],
    };

    await saveProfileStepOne(user.id, {
      ...base,
      positions: [
        { companyId: companyA.id, companyRaw: "Acme", title: "Engineer", startDate: new Date("2021-01-01"), endDate: null, isCurrent: true },
      ],
    });
    await prisma.professionalProfile.update({ where: { userId: user.id }, data: { currentCompanyConfirmedAt: new Date() } });

    await saveProfileStepOne(user.id, {
      ...base,
      positions: [
        { companyId: companyB.id, companyRaw: "Globex", title: "Engineer", startDate: new Date("2023-01-01"), endDate: null, isCurrent: true },
      ],
    });

    const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.currentCompanyId).toBe(companyB.id);
    expect(profile.currentCompanyConfirmedAt).toBeNull();
  });

  it("replaces target roles/tags/languages/positions on re-save rather than accumulating duplicates", async () => {
    const { field, role, skill, language, region } = await seedRefs();
    const user = await prisma.user.create({ data: { email: "c@example.com" } });
    const base = {
      professionalFieldId: field.id,
      currentRoleTitle: "Engineer",
      regionId: region.id,
      shortIntro: "x",
      positions: [] as never[],
    };

    await saveProfileStepOne(user.id, { ...base, targetRoleIds: [role.id], tagIds: [skill.id], languageIds: [language.id] });
    await saveProfileStepOne(user.id, { ...base, targetRoleIds: [role.id], tagIds: [skill.id], languageIds: [language.id] });

    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: { targetRoles: true, tags: true, languages: true },
    });
    expect(profile.targetRoles).toHaveLength(1);
    expect(profile.tags).toHaveLength(1);
    expect(profile.languages).toHaveLength(1);
  });
});

describe("completePrivacyOnboarding", () => {
  it("refuses to proceed without explicit employer confirmation", async () => {
    const { field, role, region } = await seedRefs();
    const user = await prisma.user.create({ data: { email: "d@example.com" } });
    await saveProfileStepOne(user.id, {
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      currentRoleTitle: "Engineer",
      regionId: region.id,
      shortIntro: "x",
      tagIds: [],
      languageIds: [],
      positions: [],
    });

    await expect(
      completePrivacyOnboarding(user.id, {
        employerConfirmed: false,
        blockEntireCorporateGroup: true,
        additionalBlockedCompanies: [],
        preMatchDisplayMode: "ALIAS",
        aliasText: "מ.",
        shareFullNamePostMatch: false,
        sharePhotoPostMatch: false,
        shareLinkedInPostMatch: false,
        sharePreciseLocationPostMatch: false,
        shareEmailPostMatch: false,
        sharePhonePostMatch: false,
        resumeRetentionPreference: "DELETE_AFTER_CONFIRMATION",
      }),
    ).rejects.toThrow();

    const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.currentCompanyConfirmedAt).toBeNull();
  });

  it("confirms the employer, stores blocks, disclosure prefs, and audit confirmations", async () => {
    const { field, role, region } = await seedRefs();
    const currentCo = await prisma.company.create({ data: { canonicalName: "Acme" } });
    const formerCo = await prisma.company.create({ data: { canonicalName: "OldCo" } });
    const user = await prisma.user.create({ data: { email: "e@example.com" } });

    await saveProfileStepOne(user.id, {
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      currentRoleTitle: "Engineer",
      regionId: region.id,
      shortIntro: "x",
      tagIds: [],
      languageIds: [],
      positions: [
        { companyId: currentCo.id, companyRaw: "Acme", title: "Engineer", startDate: new Date("2021-01-01"), endDate: null, isCurrent: true },
      ],
    });

    await completePrivacyOnboarding(user.id, {
      employerConfirmed: true,
      blockEntireCorporateGroup: true,
      additionalBlockedCompanies: [{ companyId: formerCo.id, reason: "FORMER_EMPLOYER" }],
      preMatchDisplayMode: "ALIAS",
      aliasText: "מ.",
      shareFullNamePostMatch: false,
      sharePhotoPostMatch: false,
      shareLinkedInPostMatch: false,
      sharePreciseLocationPostMatch: false,
      shareEmailPostMatch: false,
      sharePhonePostMatch: false,
      resumeRetentionPreference: "DELETE_AFTER_CONFIRMATION",
    });

    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: { privacyPreference: true, disclosurePreference: true },
    });
    expect(profile.currentCompanyConfirmedAt).not.toBeNull();
    expect(profile.status).toBe("INCOMPLETE");
    expect(profile.privacyPreference?.blockEntireCorporateGroup).toBe(true);
    expect(profile.disclosurePreference?.aliasText).toBe("מ.");

    const blocked = await prisma.blockedCompany.findMany({ where: { userId: user.id } });
    expect(blocked).toHaveLength(1);
    expect(blocked[0].companyId).toBe(formerCo.id);

    const confirmations = await prisma.userConfirmation.findMany({ where: { userId: user.id } });
    expect(confirmations.map((c) => c.type).sort()).toEqual(["EMPLOYER_CONFIRMED", "PRIVACY_ONBOARDING_CONFIRMED"]);
  });
});

describe("completeConnectionPreferences", () => {
  it("refuses to activate the profile before the employer is confirmed", async () => {
    const { field, role, region } = await seedRefs();
    const user = await prisma.user.create({ data: { email: "f@example.com" } });
    await saveProfileStepOne(user.id, {
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      currentRoleTitle: "Engineer",
      regionId: region.id,
      shortIntro: "x",
      tagIds: [],
      languageIds: [],
      positions: [],
    });

    await expect(
      completeConnectionPreferences(user.id, {
        peerMinExperienceMonths: 0,
        peerMaxExperienceMonths: 120,
        format: "BOTH",
        cadence: "BOTH",
        mode: "BOTH",
        languageId: null,
        timezone: "Asia/Jerusalem",
        reasons: ["SHARE_JOB_SEARCH"],
        availability: [],
      }),
    ).rejects.toThrow();
  });

  it("activates the profile once preferences are saved", async () => {
    const { field, role, region, language } = await seedRefs();
    const user = await prisma.user.create({ data: { email: "g@example.com" } });
    await saveProfileStepOne(user.id, {
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      currentRoleTitle: "Engineer",
      regionId: region.id,
      shortIntro: "x",
      tagIds: [],
      languageIds: [],
      positions: [],
    });
    await completePrivacyOnboarding(user.id, {
      employerConfirmed: true,
      blockEntireCorporateGroup: true,
      additionalBlockedCompanies: [],
      preMatchDisplayMode: "FIRST_NAME",
      firstName: "מיכל",
      shareFullNamePostMatch: false,
      sharePhotoPostMatch: false,
      shareLinkedInPostMatch: false,
      sharePreciseLocationPostMatch: false,
      shareEmailPostMatch: false,
      sharePhonePostMatch: false,
      resumeRetentionPreference: "DELETE_AFTER_CONFIRMATION",
    });

    expect(await getOnboardingStep(user.id)).toBe("preferences");

    await completeConnectionPreferences(user.id, {
      peerMinExperienceMonths: 0,
      peerMaxExperienceMonths: 120,
      format: "BOTH",
      cadence: "BOTH",
      mode: "ONLINE",
      languageId: language.id,
      timezone: "Asia/Jerusalem",
      reasons: ["SHARE_JOB_SEARCH", "ACCOUNTABILITY"],
      availability: [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
    });

    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: { connectionPreference: true, availabilitySlots: true },
    });
    expect(profile.status).toBe("ACTIVE");
    expect(profile.connectionPreference?.reasons).toEqual(["SHARE_JOB_SEARCH", "ACCOUNTABILITY"]);
    expect(profile.availabilitySlots).toHaveLength(1);
    expect(await getOnboardingStep(user.id)).toBe("done");
  });
});

describe("getOnboardingStep", () => {
  it("walks profile -> privacy -> preferences -> done as steps complete", async () => {
    const { field, role, region, language } = await seedRefs();
    const user = await prisma.user.create({ data: { email: "h@example.com" } });

    expect(await getOnboardingStep(user.id)).toBe("profile");

    await saveProfileStepOne(user.id, {
      professionalFieldId: field.id,
      targetRoleIds: [role.id],
      currentRoleTitle: "Engineer",
      regionId: region.id,
      shortIntro: "x",
      tagIds: [],
      languageIds: [],
      positions: [],
    });
    expect(await getOnboardingStep(user.id)).toBe("privacy");

    await completePrivacyOnboarding(user.id, {
      employerConfirmed: true,
      blockEntireCorporateGroup: true,
      additionalBlockedCompanies: [],
      preMatchDisplayMode: "ALIAS",
      aliasText: "א.",
      shareFullNamePostMatch: false,
      sharePhotoPostMatch: false,
      shareLinkedInPostMatch: false,
      sharePreciseLocationPostMatch: false,
      shareEmailPostMatch: false,
      sharePhonePostMatch: false,
      resumeRetentionPreference: "DELETE_AFTER_CONFIRMATION",
    });
    expect(await getOnboardingStep(user.id)).toBe("preferences");

    await completeConnectionPreferences(user.id, {
      peerMinExperienceMonths: 0,
      peerMaxExperienceMonths: 120,
      format: "BOTH",
      cadence: "BOTH",
      mode: "BOTH",
      languageId: language.id,
      timezone: "Asia/Jerusalem",
      reasons: [],
      availability: [],
    });
    expect(await getOnboardingStep(user.id)).toBe("done");
  });
});
