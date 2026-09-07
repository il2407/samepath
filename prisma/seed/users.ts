import { PrismaClient } from "@/generated/prisma/client";
import { calculateExperienceMonths, deriveSeniorityBandCode } from "@/modules/profiles/experience";
import { hashPassword } from "@/modules/auth/password";

/** Every seeded user (including the admin) logs in with this password locally — see README "Local development setup". */
export const SEED_DEV_PASSWORD = "samepath-dev-password";

/**
 * Fictional development users exercising the key privacy/matching scenarios
 * from the spec: same-company exclusion, corporate-group exclusion, a
 * user blocking a former employer, differing experience levels, and
 * differing availability. Never real personal data.
 *
 * Writes directly via Prisma rather than through the onboarding service
 * layer — that layer is marked server-only (guarded against import outside
 * the Next.js server runtime), which this plain script doesn't run under.
 */
export async function seedUsers(prisma: PrismaClient) {
  const devPasswordHash = await hashPassword(SEED_DEV_PASSWORD);
  const field = await prisma.professionalField.findUniqueOrThrow({ where: { code: "software-engineering" } });
  const backendRole = await prisma.targetRole.findUniqueOrThrow({ where: { code: "backend-developer" } });
  const fullstackRole = await prisma.targetRole.findUniqueOrThrow({ where: { code: "fullstack-backend-oriented" } });
  const bands = await prisma.seniorityBand.findMany();
  const hebrew = await prisma.language.findUniqueOrThrow({ where: { code: "he" } });
  const english = await prisma.language.findUniqueOrThrow({ where: { code: "en" } });
  const centerRegion = await prisma.region.findUniqueOrThrow({ where: { code: "il-center" } });
  const telAvivRegion = await prisma.region.findUniqueOrThrow({ where: { code: "il-tel-aviv" } });
  const typescript = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "typescript" } });
  const postgres = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "postgresql" } });
  const fintech = await prisma.tag.findFirstOrThrow({ where: { kind: "DOMAIN", slug: "fintech" } });

  const standardPass = await prisma.productConfiguration.findUniqueOrThrow({ where: { key: "standard-pass" } });

  const northwindParent = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-northwind" } });
  const northwindIsrael = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-northwind-il" } });
  const initech = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-initech" } });
  const globex = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-globex" } });
  const umbrella = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-umbrella" } });
  const acme = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-acme" } });

  function bandIdFor(months: number): string | null {
    const code = deriveSeniorityBandCode(
      months,
      bands.map((b) => ({ code: b.code, minMonths: b.minMonths, maxMonths: b.maxMonths })),
    );
    return code ? (bands.find((b) => b.code === code)?.id ?? null) : null;
  }

  function monthsAgo(n: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d;
  }

  interface SeedUserInput {
    id: string;
    email: string;
    shortIntro: string;
    companyId: string;
    startedMonthsAgo: number;
    blockEntireCorporateGroup?: boolean;
    blockedCompanyIds?: string[];
    regionId?: string;
    targetRoleIds?: string[];
    languageIds?: string[];
    availability?: { dayOfWeek: number; startMinute: number; endMinute: number }[];
    shareCompanyPreMatch?: boolean;
    gender?: "MALE" | "FEMALE";
    genderPreference?: "MALE" | "FEMALE" | "BOTH";
  }

  async function seedUser(input: SeedUserInput) {
    const experienceMonths = calculateExperienceMonths([{ startDate: monthsAgo(input.startedMonthsAgo), endDate: null }]);
    const seniorityBandId = bandIdFor(experienceMonths);
    const targetRoleIds = input.targetRoleIds ?? [backendRole.id];
    const languageIds = input.languageIds ?? [hebrew.id];
    const availability = input.availability ?? [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }];

    const user = await prisma.user.upsert({
      where: { id: input.id },
      update: {},
      create: { id: input.id, email: input.email, emailVerifiedAt: new Date(), status: "ACTIVE" },
    });

    await prisma.authIdentity.upsert({
      where: { provider_providerAccountId: { provider: "EMAIL", providerAccountId: input.email } },
      update: { passwordHash: devPasswordHash },
      create: { userId: user.id, provider: "EMAIL", providerAccountId: input.email, passwordHash: devPasswordHash },
    });

    const profile = await prisma.professionalProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        professionalFieldId: field.id,
        currentRoleTitle: "מפתח/ת Backend",
        regionId: input.regionId ?? centerRegion.id,
        experienceMonths,
        seniorityBandId,
        shortIntro: input.shortIntro,
        currentCompanyId: input.companyId,
        currentCompanyConfirmedAt: new Date(),
        status: "ACTIVE",
        gender: input.gender,
        targetRoles: { create: targetRoleIds.map((targetRoleId) => ({ targetRoleId })) },
        tags: { create: [{ tagId: typescript.id }, { tagId: postgres.id }, { tagId: fintech.id }] },
        languages: { create: languageIds.map((languageId) => ({ languageId })) },
        privacyPreference: { create: { blockEntireCorporateGroup: input.blockEntireCorporateGroup ?? true } },
        connectionPreference: {
          create: {
            format: "BOTH",
            cadence: "BOTH",
            mode: "ONLINE",
            timezone: "Asia/Jerusalem",
            reasons: ["SHARE_JOB_SEARCH", "ACCOUNTABILITY"],
            genderPreference: input.genderPreference ?? "BOTH",
          },
        },
        disclosurePreference: {
          create: {
            shareCompanyPreMatch: input.shareCompanyPreMatch ?? false,
          },
        },
        availabilitySlots: { create: availability },
        employmentPositions: {
          create: [
            {
              companyId: input.companyId,
              companyRaw: "",
              title: "מפתח/ת Backend",
              startDate: monthsAgo(input.startedMonthsAgo),
              isCurrent: true,
              source: "MANUAL",
            },
          ],
        },
      },
    });

    if (input.blockedCompanyIds?.length) {
      for (const companyId of input.blockedCompanyIds) {
        await prisma.blockedCompany.upsert({
          where: { userId_companyId: { userId: user.id, companyId } },
          update: {},
          create: { userId: user.id, companyId, reason: "FORMER_EMPLOYER" },
        });
      }
    }

    return { user, profile };
  }

  // Same-company pair: must never match each other.
  const dana = await seedUser({
    id: "seed-user-dana",
    gender: "FEMALE",
    email: "dana@example.com",
    shortIntro: "מפתחת Backend עם ניסיון במערכות תשלומים, מחפשת לשוחח על תהליך החיפוש.",
    companyId: northwindParent.id,
    startedMonthsAgo: 30,
  });
  const yossi = await seedUser({
    id: "seed-user-yossi",
    gender: "MALE",
    email: "yossi@example.com",
    shortIntro: "מפתח Backend, מתעניין בדיונים מקצועיים ותרגול system design.",
    companyId: northwindParent.id,
    startedMonthsAgo: 40,
  });

  // Corporate-group pair: subsidiary of dana/yossi's employer — must not match them either.
  const noa = await seedUser({
    id: "seed-user-noa",
    gender: "FEMALE",
    email: "noa@example.com",
    shortIntro: "מפתחת Backend, עברתי לאחרונה לתפקיד חדש ומחפשת ליווי בתהליך ההשתלבות.",
    companyId: northwindIsrael.id,
    startedMonthsAgo: 6,
  });

  // A user who blocks a former employer.
  const avi = await seedUser({
    id: "seed-user-avi",
    gender: "MALE",
    email: "avi@example.com",
    shortIntro: "מפתח Backend בכיר, מחפש קבוצת דיון קבועה.",
    companyId: initech.id,
    startedMonthsAgo: 84,
    blockedCompanyIds: [globex.id],
  });
  const maya = await seedUser({
    id: "seed-user-maya",
    gender: "FEMALE",
    email: "maya@example.com",
    shortIntro: "מפתחת Backend, מתעניינת בשיתוף חוויות מתהליכי ריאיון.",
    companyId: globex.id, // the company avi blocked — must never match avi
    startedMonthsAgo: 20,
  });

  // Compatible Backend users with clearly different experience levels.
  const ronit = await seedUser({
    id: "seed-user-ronit",
    gender: "FEMALE",
    email: "ronit@example.com",
    shortIntro: "מפתחת Backend בתחילת הדרך, מחפשת ליווי וללמוד יחד.",
    companyId: umbrella.id,
    startedMonthsAgo: 10, // junior
    targetRoleIds: [backendRole.id, fullstackRole.id],
    languageIds: [hebrew.id, english.id],
    regionId: telAvivRegion.id,
  });
  const eitan = await seedUser({
    id: "seed-user-eitan",
    gender: "MALE",
    email: "eitan@example.com",
    shortIntro: "מפתח Backend ותיק, שמח לשתף ניסיון וללוות מפתחים בתחילת הדרך.",
    companyId: acme.id,
    startedMonthsAgo: 130, // staff/principal
    regionId: telAvivRegion.id,
  });

  // Overlapping vs non-overlapping availability.
  const tal = await seedUser({
    id: "seed-user-tal",
    gender: "MALE",
    email: "tal@example.com",
    shortIntro: "מפתח Backend, זמין לשיחות בבקרים.",
    companyId: initech.id,
    startedMonthsAgo: 45,
    availability: [{ dayOfWeek: 0, startMinute: 480, endMinute: 600 }],
  });
  const shira = await seedUser({
    id: "seed-user-shira",
    gender: "FEMALE",
    email: "shira@example.com",
    shortIntro: "מפתחת Backend, זמינה בעיקר בערבים.",
    companyId: umbrella.id,
    startedMonthsAgo: 50,
    availability: [{ dayOfWeek: 4, startMinute: 1080, endMinute: 1260 }],
  });

  // A clean, unblocked pair who both opted into shareCompanyPreMatch — the
  // fastest way to see the pre-match employer reveal actually render, with
  // no settings toggling needed first. Different companies, no corporate
  // group between them, no blocks either direction.
  const omer = await seedUser({
    id: "seed-user-omer",
    gender: "MALE",
    email: "omer@example.com",
    shortIntro: "מפתח Backend, שמח לחשוף את המעסיק כבר לפני אישור הדדי.",
    companyId: umbrella.id,
    startedMonthsAgo: 60,
    shareCompanyPreMatch: true,
  });
  const liat = await seedUser({
    id: "seed-user-liat",
    gender: "FEMALE",
    email: "liat@example.com",
    shortIntro: "מפתחת Backend, גם אני חושפת את המעסיק כבר לפני אישור הדדי.",
    companyId: acme.id,
    startedMonthsAgo: 55,
    shareCompanyPreMatch: true,
  });

  // A pending mutual-interest scenario: eitan has already marked "interested"
  // in avi (a compatible, unblocked pair — different companies, no corporate
  // group, no blocks either direction). Log in as avi (avi@example.com /
  // SEED_DEV_PASSWORD) and open "הצעות התאמה" (/app/matches): eitan's
  // suggestion is already there, and clicking "רוצה להתחבר" completes the
  // mutual match immediately, since the other side already said yes. Both
  // are also granted an active access pass so the resulting match opens a
  // real, active connection instead of stalling at the paywall.
  async function grantActiveAccessPass(userId: string) {
    const existing = await prisma.accessPass.findFirst({ where: { userId, status: "ACTIVE" } });
    if (existing) return;
    const activatedAt = new Date();
    const accessPass = await prisma.accessPass.create({
      data: {
        userId,
        productConfigId: standardPass.id,
        status: "ACTIVE",
        activationEventType: "MANUAL",
        durationDays: standardPass.accessDurationDays,
        activatedAt,
        expiresAt: new Date(activatedAt.getTime() + standardPass.accessDurationDays * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.accessPassEvent.create({ data: { accessPassId: accessPass.id, type: "ACTIVATED" } });
  }

  // Reuse a suggestion between avi and eitan if one already exists (e.g. from
  // clicking "חיפוש התאמות חדשות" during manual testing) rather than creating
  // a second, duplicate card for the same pair.
  const existingAviEitanSuggestion = await prisma.matchSuggestion.findFirst({
    where: {
      status: { in: ["PROPOSED", "INTERESTED_BY_A", "INTERESTED_BY_B"] },
      OR: [
        { userAId: avi.user.id, userBId: eitan.user.id },
        { userAId: eitan.user.id, userBId: avi.user.id },
      ],
    },
  });

  const aviEitanMatchId = existingAviEitanSuggestion?.id ?? "seed-match-avi-eitan";
  if (!existingAviEitanSuggestion) {
    await prisma.matchSuggestion.upsert({
      where: { id: aviEitanMatchId },
      update: {},
      create: {
        id: aviEitanMatchId,
        userAId: avi.user.id,
        userBId: eitan.user.id,
        profileAId: avi.profile.id,
        profileBId: eitan.profile.id,
        status: "INTERESTED_BY_B",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.matchScoreBreakdown.upsert({
      where: { matchSuggestionId: aviEitanMatchId },
      update: {},
      create: {
        matchSuggestionId: aviEitanMatchId,
        targetRoleScore: 0.9,
        fieldScore: 1,
        experienceScore: 0.6,
        availabilityScore: 0.7,
        skillsScore: 0.8,
        languageScore: 1,
        totalScore: 0.83,
        weightsVersion: "default-v1",
      },
    });
  }
  await prisma.matchDecision.upsert({
    where: { matchSuggestionId_userId: { matchSuggestionId: aviEitanMatchId, userId: eitan.user.id } },
    update: { decision: "INTERESTED" },
    create: { matchSuggestionId: aviEitanMatchId, userId: eitan.user.id, decision: "INTERESTED" },
  });
  await grantActiveAccessPass(avi.user.id);
  await grantActiveAccessPass(eitan.user.id);

  // A small eligible group (avi, ronit, eitan — none of them conflict).
  const eligibleGroup = await prisma.group.upsert({
    where: { id: "seed-group-eligible" },
    update: {},
    create: {
      id: "seed-group-eligible",
      title: "קבוצת תמיכה למפתחי Backend",
      professionalFieldId: field.id,
      targetRoleId: backendRole.id,
      languageId: hebrew.id,
      timezone: "Asia/Jerusalem",
      mode: "ONLINE",
      schedule: "כל יום שלישי, 18:00",
      capacityMin: 3,
      capacityMax: 6,
      status: "OPEN",
      theme: "תהליך חיפוש ומעבר תפקיד",
      seriesLength: 6,
    },
  });
  for (const member of [avi, ronit, eitan]) {
    await prisma.groupMembership.upsert({
      where: { groupId_userId: { groupId: eligibleGroup.id, userId: member.user.id } },
      update: {},
      create: { groupId: eligibleGroup.id, userId: member.user.id, status: "ACTIVE" },
    });
  }

  // A group containing dana — hidden for noa (corporate-group conflict) even
  // though it's a perfectly normal, eligible group for everyone else.
  const conflictedGroup = await prisma.group.upsert({
    where: { id: "seed-group-conflicted" },
    update: {},
    create: {
      id: "seed-group-conflicted",
      title: "קבוצת דיון: מעבר לתפקיד ניהולי",
      professionalFieldId: field.id,
      targetRoleId: backendRole.id,
      languageId: hebrew.id,
      timezone: "Asia/Jerusalem",
      mode: "ONLINE",
      schedule: "כל שני שני, 20:00",
      capacityMin: 3,
      capacityMax: 5,
      status: "OPEN",
      theme: "צמיחה מקצועית",
    },
  });
  for (const member of [dana, yossi]) {
    await prisma.groupMembership.upsert({
      where: { groupId_userId: { groupId: conflictedGroup.id, userId: member.user.id } },
      update: {},
      create: { groupId: conflictedGroup.id, userId: member.user.id, status: "ACTIVE" },
    });
  }

  // Admin/moderator account for the internal admin area — no professional
  // profile, since admins access /admin rather than the member-facing /app.
  const admin = await prisma.user.upsert({
    where: { id: "seed-user-admin" },
    update: {},
    create: {
      id: "seed-user-admin",
      email: "admin@example.com",
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
      role: "ADMIN",
    },
  });

  await prisma.authIdentity.upsert({
    where: { provider_providerAccountId: { provider: "EMAIL", providerAccountId: admin.email } },
    update: { passwordHash: devPasswordHash },
    create: { userId: admin.id, provider: "EMAIL", providerAccountId: admin.email, passwordHash: devPasswordHash },
  });

  return { dana, yossi, noa, avi, maya, ronit, eitan, tal, shira, eligibleGroup, conflictedGroup };
}
