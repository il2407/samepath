import { PrismaClient } from "@/generated/prisma/client";
import { calculateExperienceMonths, deriveSeniorityBandCode } from "@/modules/profiles/experience";
import { hashPassword } from "@/modules/auth/password";

/** Every seeded user (including the admin) logs in with this password locally — see README "Local development setup". */
export const SEED_DEV_PASSWORD = "samepath-dev-password";

/**
 * Fictional development users exercising the key privacy/matching scenarios
 * from the spec — same-company exclusion, corporate-group exclusion (both
 * as a hard block and, deliberately, as an opt-out), a user blocking a
 * former employer, and a realistic spread of match strength (strong,
 * moderate, weak, and explicitly divergent) across professional field,
 * target role, seniority, tags, and availability. Never real
 * personal data.
 *
 * Writes directly via Prisma rather than through the onboarding service
 * layer — that layer is marked server-only (guarded against import outside
 * the Next.js server runtime), which this plain script doesn't run under.
 *
 * ---------------------------------------------------------------------
 * PERSONA MAP — who should (and must never) match whom, and why
 * ---------------------------------------------------------------------
 *
 * `src/modules/matching/scoring.ts`'s DEFAULT_SCORING_WEIGHTS: targetRole
 * 0.30, professionalField 0.20, experience 0.15, availability 0.15,
 * skills 0.10, timezone/style 0.10 — targetRole and
 * professionalField dominate, with experience and availability tied for
 * third. Every persona below varies deliberately across these dimensions
 * (not just cosmetically) rather than sharing one hardcoded field/role/
 * tag/availability slot the way the previous version of this file did —
 * that hardcoding was the root cause of every pair looking ~100%
 * compatible regardless of who was being compared.
 *
 * PRIVACY-BLOCKED PAIRS (never shown as matches, regardless of score):
 * - dana + yossi: same company (Northwind Dynamics) — same-company block.
 * - noa + dana, noa + yossi: noa is at Northwind Dynamics Israel, a
 *   subsidiary in the same corporate group — corporate-group block (noa
 *   keeps the default blockEntireCorporateGroup: true).
 * - boaz + dana, boaz + yossi: boaz is also at Northwind Dynamics (parent)
 *   — plain same-company block, independent of the corporate-group demo
 *   below.
 * - boaz + noa, tamar + dana, tamar + yossi: cross-entity Northwind pairs
 *   — still corporate-group blocked, because dana/yossi/noa all keep the
 *   *default* blockEntireCorporateGroup: true, and the check is an OR:
 *   either side keeping the block on is enough to block the pair, even
 *   though boaz/tamar themselves opted out (see below).
 * - tamar + noa: both at Northwind Dynamics Israel — same-company block.
 * - avi + maya: avi has blockedCompanyIds: [globex], maya is at Globex —
 *   blocked-company block.
 * - avi + michal, maya + michal: michal is also at Globex — michal
 *   inherits avi's block (blocked-company) and is same-company blocked
 *   from maya.
 * - avi + tal: both at Initech — same-company block (incidental, was
 *   already true before this change).
 * - hila + eitan, hila + liat: all three at Acme — same-company block.
 * - hila + ronit, hila + shira, hila + omer: hila has
 *   blockedCompanyIds: [umbrella] (a second, independent example of the
 *   blocked-former-employer scenario, alongside avi's) — blocked-company
 *   block against everyone at Umbrella.
 *
 * THE ONE "OPT-OUT ALLOWS IT" DEMONSTRATION:
 * - boaz (Northwind Dynamics) + tamar (Northwind Dynamics Israel): same
 *   corporate group as dana/yossi/noa, but BOTH boaz and tamar explicitly
 *   set blockEntireCorporateGroup: false — since the rule is an OR over
 *   both sides, this is the one Northwind-group pair that is NOT blocked.
 *   Same devops-engineer role/tags/availability on both sides,
 *   so once the privacy gate lets them through, they also score as a
 *   strong match (~99%, verified below) — proof the flag is a real,
 *   independent per-user opt-in, not a structural given.
 *
 * PENDING MUTUAL-INTEREST SCENARIO (unchanged pairing, still compatible):
 * - avi + eitan: different companies (Initech / Acme), no corporate group,
 *   no blocks either direction. eitan already marked INTERESTED in a
 *   MatchSuggestion; both hold an active access pass. Log in as avi to see
 *   a ready-to-complete match. Kept genuinely compatible (same field,
 *   same backend-developer role, same Thursday 16:00-18:00 availability
 *   slot) even after this change, deliberately, so the scenario still
 *   works exactly as before — verified with the pure scoring function at
 *   ~80.5% (role 1.0, field 1.0, availability 1.0, skills 0
 *   since eitan's tags no longer overlap avi's, experience 0.23 since
 *   avi is senior and eitan is staff/principal).
 *
 * shareCompanyPreMatch REVEAL PAIR (unchanged) + more examples:
 * - omer + liat: the original clean, unblocked, opted-in pair (different
 *   companies, no corporate group, no blocks).
 * - tamar and guy also set shareCompanyPreMatch: true, so the reveal isn't
 *   demonstrated by only one pair anymore.
 *
 * SCORE-SPECTRUM EXAMPLES (all privacy-allowed; percentages below were
 * computed by feeding this file's actual field/role/tag/
 * availability choices into the real, unmodified `computeScoreBreakdown`
 * in a standalone, DB-free script — not hand-estimated):
 * - STRONG (~99%): guy (Soundwave, data-engineer) vs hila (Acme,
 *   data-engineer) — identical role, tags, and availability
 *   slot, adjacent seniority, different unrelated companies, no block.
 * - STRONG (~99%): boaz vs tamar — see the opt-out demonstration above.
 * - MODERATE (~45%): dana vs guy — same field, but
 *   different role, mostly-disjoint tags, non-overlapping availability.
 * - WEAK (~30%): eitan vs guy (or hila) — same field only;
 *   disjoint role, tags, and availability, and a huge seniority gap
 *   (staff/principal vs mid) zeroes out the experience term entirely.
 * - DIVERGENT NON-MATCH, not privacy-blocked (~6-16%): avi vs nadav, and
 *   michal vs nadav — nadav is in a different professional field
 *   (product, not software-engineering) with no target role at all, a
 *   a huge seniority gap,
 *   and an atypical (Saturday) availability slot. Nothing here is a
 *   privacy rule; the two people are just realistically incompatible.
 * - EXPLICIT NON-MATCH, privacy-blocked: every pair in the first list
 *   above — score is never even computed for these, by design (Stage A
 *   always runs before Stage B).
 *
 * avi SPECIFICALLY (requirement: must not look ~100% compatible with
 * everyone) now varies relative to other unblocked personas on the two
 * heaviest-weighted dimensions and both third-place dimensions:
 * targetRole (backend-developer only — 0% overlap with guy/hila's
 * data-engineer or boaz/tamar's devops-engineer, 0% with nadav's empty
 * role list), professionalField (0% overlap with nadav's "product"),
 * experience (84 months — far from nadav's 3, guy/hila's ~36-40, and
 * boaz/tamar's ~42-46), and availability (Thursday 16:00-18:00 — shared
 * only with eitan, zero overlap with every other persona's slot). Verified
 * scores: avi vs guy ~34.7%, avi vs boaz ~34.5%, avi vs nadav ~6.0%.
 *
 * EMPLOYER SPREAD: every one of the seven seed companies
 * (`prisma/seed/companies.ts`) now has at least one person, including
 * Soundwave Labs (previously unused) — guy is there.
 */
export async function seedUsers(prisma: PrismaClient) {
  const devPasswordHash = await hashPassword(SEED_DEV_PASSWORD);

  // Professional fields.
  const field = await prisma.professionalField.findUniqueOrThrow({ where: { code: "software-engineering" } });
  const productField = await prisma.professionalField.findUniqueOrThrow({ where: { code: "product" } });

  // Target roles (all currently scoped to the software-engineering field in
  // reference-data.ts — v1 markets narrowly to backend/backend-oriented
  // roles, but several distinct ones already exist, which is enough to
  // demonstrate real targetRole divergence without inventing new rows).
  const backendRole = await prisma.targetRole.findUniqueOrThrow({ where: { code: "backend-developer" } });
  const fullstackRole = await prisma.targetRole.findUniqueOrThrow({ where: { code: "fullstack-backend-oriented" } });
  const devopsRole = await prisma.targetRole.findUniqueOrThrow({ where: { code: "devops-engineer" } });
  const dataEngineerRole = await prisma.targetRole.findUniqueOrThrow({ where: { code: "data-engineer" } });
  const frontendRole = await prisma.targetRole.findUniqueOrThrow({ where: { code: "frontend-developer" } });

  const bands = await prisma.seniorityBand.findMany();


  const centerRegion = await prisma.region.findUniqueOrThrow({ where: { code: "il-center" } });
  const telAvivRegion = await prisma.region.findUniqueOrThrow({ where: { code: "il-tel-aviv" } });
  const southRegion = await prisma.region.findUniqueOrThrow({ where: { code: "il-south" } });
  const haifaNorthRegion = await prisma.region.findUniqueOrThrow({ where: { code: "il-haifa-north" } });

  // Skill/domain tags (shared Tag table — see architecture-decisions.md #6).
  const typescript = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "typescript" } });
  const postgres = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "postgresql" } });
  const python = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "python" } });
  const kafka = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "kafka" } });
  const docker = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "docker" } });
  const kubernetes = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "kubernetes" } });
  const aws = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "aws" } });
  const nodeJs = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "node-js" } });
  const graphql = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "graphql" } });
  const systemDesign = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "system-design" } });
  const microservices = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "microservices" } });
  const redis = await prisma.tag.findFirstOrThrow({ where: { kind: "SKILL", slug: "redis" } });
  const fintech = await prisma.tag.findFirstOrThrow({ where: { kind: "DOMAIN", slug: "fintech" } });
  const ecommerce = await prisma.tag.findFirstOrThrow({ where: { kind: "DOMAIN", slug: "e-commerce" } });
  const healthtech = await prisma.tag.findFirstOrThrow({ where: { kind: "DOMAIN", slug: "healthtech" } });
  const cybersecurity = await prisma.tag.findFirstOrThrow({ where: { kind: "DOMAIN", slug: "cybersecurity" } });
  const enterpriseSaas = await prisma.tag.findFirstOrThrow({ where: { kind: "DOMAIN", slug: "enterprise-saas" } });
  const governmentPublicSector = await prisma.tag.findFirstOrThrow({
    where: { kind: "DOMAIN", slug: "government-public-sector" },
  });

  const standardPass = await prisma.productConfiguration.findUniqueOrThrow({ where: { key: "standard-pass" } });

  const northwindParent = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-northwind" } });
  const northwindIsrael = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-northwind-il" } });
  const initech = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-initech" } });
  const globex = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-globex" } });
  const umbrella = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-umbrella" } });
  const soundwave = await prisma.company.findUniqueOrThrow({ where: { id: "seed-co-soundwave" } });
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
    currentRoleTitle?: string;
    professionalFieldId?: string;
    blockEntireCorporateGroup?: boolean;
    blockedCompanyIds?: string[];
    regionId?: string;
    targetRoleIds?: string[];
    tagIds?: string[];
    availability?: { dayOfWeek: number; startMinute: number; endMinute: number }[];
    shareCompanyPreMatch?: boolean;
    gender?: "MALE" | "FEMALE";
    genderPreference?: "MALE" | "FEMALE" | "BOTH";
  }

  async function seedUser(input: SeedUserInput) {
    const experienceMonths = calculateExperienceMonths([{ startDate: monthsAgo(input.startedMonthsAgo), endDate: null }]);
    const seniorityBandId = bandIdFor(experienceMonths);
    const professionalFieldId = input.professionalFieldId ?? field.id;
    const currentRoleTitle = input.currentRoleTitle ?? "מפתח/ת Backend";
    const targetRoleIds = input.targetRoleIds ?? [backendRole.id];
    const tagIds = input.tagIds ?? [typescript.id, postgres.id, fintech.id];
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
        professionalFieldId,
        currentRoleTitle,
        regionId: input.regionId ?? centerRegion.id,
        experienceMonths,
        seniorityBandId,
        shortIntro: input.shortIntro,
        currentCompanyId: input.companyId,
        currentCompanyConfirmedAt: new Date(),
        status: "ACTIVE",
        gender: input.gender,
        targetRoles: { create: targetRoleIds.map((targetRoleId) => ({ targetRoleId })) },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
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
              title: currentRoleTitle,
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
    availability: [{ dayOfWeek: 0, startMinute: 540, endMinute: 660 }], // Sunday 09:00-11:00
  });
  const yossi = await seedUser({
    id: "seed-user-yossi",
    gender: "MALE",
    email: "yossi@example.com",
    shortIntro: "מפתח Backend, מתעניין בדיונים מקצועיים ותרגול system design.",
    companyId: northwindParent.id,
    startedMonthsAgo: 40,
    availability: [{ dayOfWeek: 1, startMinute: 840, endMinute: 960 }], // Monday 14:00-16:00
  });

  // Corporate-group pair: subsidiary of dana/yossi's employer — must not match them either.
  const noa = await seedUser({
    id: "seed-user-noa",
    gender: "FEMALE",
    email: "noa@example.com",
    shortIntro: "מפתחת Backend, עברתי לאחרונה לתפקיד חדש ומחפשת ליווי בתהליך ההשתלבות.",
    companyId: northwindIsrael.id,
    startedMonthsAgo: 6,
    availability: [{ dayOfWeek: 3, startMinute: 480, endMinute: 600 }], // Wednesday 08:00-10:00
  });

  // A user who blocks a former employer. Deliberately given a distinct
  // availability slot (Thursday afternoon, shared only with eitan below)
  // and a tag set that doesn't fully overlap the typescript/postgres/
  // fintech default cluster, so avi doesn't score ~100% against every
  // other backend-developer persona in the file — see the PERSONA MAP
  // comment above for the verified numbers.
  const avi = await seedUser({
    id: "seed-user-avi",
    gender: "MALE",
    email: "avi@example.com",
    shortIntro: "מפתח Backend בכיר, מחפש קבוצת דיון קבועה.",
    companyId: initech.id,
    startedMonthsAgo: 84,
    blockedCompanyIds: [globex.id],
    tagIds: [typescript.id, kubernetes.id, cybersecurity.id],
    availability: [{ dayOfWeek: 4, startMinute: 960, endMinute: 1080 }], // Thursday 16:00-18:00
  });
  const maya = await seedUser({
    id: "seed-user-maya",
    gender: "FEMALE",
    email: "maya@example.com",
    shortIntro: "מפתחת Backend, מתעניינת בשיתוף חוויות מתהליכי ריאיון.",
    companyId: globex.id, // the company avi blocked — must never match avi
    startedMonthsAgo: 20,
    availability: [{ dayOfWeek: 0, startMinute: 1200, endMinute: 1320 }], // Sunday 20:00-22:00
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
    tagIds: [typescript.id, docker.id, fintech.id],
    regionId: telAvivRegion.id,
    availability: [{ dayOfWeek: 1, startMinute: 1080, endMinute: 1200 }], // Monday 18:00-20:00
  });
  const eitan = await seedUser({
    id: "seed-user-eitan",
    gender: "MALE",
    email: "eitan@example.com",
    shortIntro: "מפתח Backend ותיק, שמח לשתף ניסיון וללוות מפתחים בתחילת הדרך.",
    companyId: acme.id,
    startedMonthsAgo: 130, // staff/principal
    regionId: telAvivRegion.id,
    tagIds: [systemDesign.id, microservices.id, fintech.id],
    // Same slot as avi on purpose — keeps the pending-mutual-interest
    // scenario below a genuinely compatible pair (see PERSONA MAP).
    availability: [{ dayOfWeek: 4, startMinute: 960, endMinute: 1080 }], // Thursday 16:00-18:00
  });

  // Overlapping vs non-overlapping availability.
  const tal = await seedUser({
    id: "seed-user-tal",
    gender: "MALE",
    email: "tal@example.com",
    shortIntro: "מפתח Backend, זמין לשיחות בבקרים.",
    companyId: initech.id,
    startedMonthsAgo: 45,
    tagIds: [typescript.id, postgres.id, ecommerce.id],
    availability: [{ dayOfWeek: 0, startMinute: 480, endMinute: 600 }],
  });
  const shira = await seedUser({
    id: "seed-user-shira",
    gender: "FEMALE",
    email: "shira@example.com",
    shortIntro: "מפתחת Backend, זמינה בעיקר בערבים.",
    companyId: umbrella.id,
    startedMonthsAgo: 50,
    tagIds: [python.id, redis.id, healthtech.id],
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
    availability: [{ dayOfWeek: 1, startMinute: 720, endMinute: 840 }], // Monday 12:00-14:00
  });
  const liat = await seedUser({
    id: "seed-user-liat",
    gender: "FEMALE",
    email: "liat@example.com",
    shortIntro: "מפתחת Backend, גם אני חושפת את המעסיק כבר לפני אישור הדדי.",
    companyId: acme.id,
    startedMonthsAgo: 55,
    shareCompanyPreMatch: true,
    availability: [{ dayOfWeek: 3, startMinute: 1140, endMinute: 1260 }], // Wednesday 19:00-21:00
  });

  // The one Northwind-group pair that DOES match despite sharing a
  // corporate group with dana/yossi/noa: both explicitly opt out of the
  // group-wide block (blockEntireCorporateGroup: false). Same role, tags,
  // and availability slot on both sides, so once the privacy
  // gate lets them through, they also score as a strong match (~99%) —
  // see the PERSONA MAP comment above. Still correctly blocked from
  // dana/yossi/noa themselves, since those three keep the *default* true,
  // and the rule is an OR over both sides of any given pair.
  const boaz = await seedUser({
    id: "seed-user-boaz",
    gender: "MALE",
    email: "boaz@example.com",
    shortIntro: "מהנדס DevOps, לא חושש משיתוף בין חברות הקבוצה התאגידית שלי.",
    companyId: northwindParent.id,
    startedMonthsAgo: 42,
    currentRoleTitle: "מהנדס/ת DevOps",
    targetRoleIds: [devopsRole.id],
    tagIds: [docker.id, kubernetes.id, aws.id],
    blockEntireCorporateGroup: false,
    availability: [{ dayOfWeek: 1, startMinute: 540, endMinute: 660 }], // Monday 09:00-11:00
  });
  const tamar = await seedUser({
    id: "seed-user-tamar",
    gender: "FEMALE",
    email: "tamar@example.com",
    shortIntro: "מהנדסת DevOps בחברת הבת הישראלית, פתוחה להכרויות גם מעבר לחברה שלי.",
    companyId: northwindIsrael.id,
    startedMonthsAgo: 46,
    currentRoleTitle: "מהנדס/ת DevOps",
    targetRoleIds: [devopsRole.id],
    tagIds: [docker.id, kubernetes.id, aws.id],
    blockEntireCorporateGroup: false,
    shareCompanyPreMatch: true,
    availability: [{ dayOfWeek: 1, startMinute: 540, endMinute: 660 }], // Monday 09:00-11:00, overlaps boaz
  });

  // Strong-match anchor pair: identical role/tags/availability,
  // adjacent seniority, unrelated companies (one of them Soundwave Labs,
  // previously unused by any seeded persona) — nothing blocks them, and
  // the score comes out to ~99% (verified with the real scoring function).
  const guy = await seedUser({
    id: "seed-user-guy",
    gender: "MALE",
    email: "guy@example.com",
    shortIntro: "מהנדס דאטה, מתעניין בתשתיות סטרימינג ובשיחות על מסחר אלקטרוני.",
    companyId: soundwave.id,
    startedMonthsAgo: 36,
    currentRoleTitle: "מהנדס/ת דאטה",
    targetRoleIds: [dataEngineerRole.id],
    tagIds: [python.id, postgres.id, kafka.id, ecommerce.id],
    regionId: telAvivRegion.id,
    shareCompanyPreMatch: true,
    availability: [{ dayOfWeek: 3, startMinute: 1080, endMinute: 1200 }], // Wednesday 18:00-20:00
  });
  const hila = await seedUser({
    id: "seed-user-hila",
    gender: "FEMALE",
    email: "hila@example.com",
    shortIntro: "מהנדסת דאטה, גם אני מגיעה מרקע של מסחר אלקטרוני.",
    companyId: acme.id,
    startedMonthsAgo: 40,
    currentRoleTitle: "מהנדס/ת דאטה",
    targetRoleIds: [dataEngineerRole.id],
    tagIds: [python.id, postgres.id, kafka.id, ecommerce.id],
    regionId: telAvivRegion.id,
    // A second, independent example of blocking a former employer (avi's
    // is the first) — unrelated to anyone else's block.
    blockedCompanyIds: [umbrella.id],
    availability: [{ dayOfWeek: 3, startMinute: 1080, endMinute: 1200 }], // Wednesday 18:00-20:00, overlaps guy
  });

  // Moderate-match example: same field as most personas, but a different
  // role, mostly-disjoint tags, English rather than Hebrew, and an
  // availability slot (Tuesday midday) that overlaps no one else's.
  const michal = await seedUser({
    id: "seed-user-michal",
    gender: "FEMALE",
    email: "michal@example.com",
    shortIntro: "Frontend developer focused on enterprise SaaS products; most comfortable communicating in English.",
    companyId: globex.id, // inherits avi's block on Globex, and is same-company blocked from maya
    startedMonthsAgo: 24,
    currentRoleTitle: "מפתח/ת Frontend",
    targetRoleIds: [frontendRole.id],
    tagIds: [typescript.id, nodeJs.id, graphql.id, enterpriseSaas.id],
    regionId: haifaNorthRegion.id,
    availability: [{ dayOfWeek: 2, startMinute: 720, endMinute: 840 }], // Tuesday 12:00-14:00
  });

  // Explicit, non-privacy-blocked non-match: a different professional
  // field entirely (product, not software-engineering), no target role at
  // all, a much shallower seniority, and an
  // atypical (Saturday) availability slot. Not blocked from anyone — the
  // very low score against, e.g., avi or michal (~6-16%, verified) comes
  // purely from real incompatibility, not a privacy rule.
  const nadav = await seedUser({
    id: "seed-user-nadav",
    gender: "MALE",
    email: "nadav@example.com",
    shortIntro: "מחפש עבודה בתחום המוצר, בתחילת הדרך המקצועית. הכי נוח לי לשוחח בערבית.",
    companyId: umbrella.id,
    startedMonthsAgo: 3, // junior
    currentRoleTitle: "מנהל/ת מוצר",
    professionalFieldId: productField.id,
    targetRoleIds: [],
    tagIds: [governmentPublicSector.id],
    regionId: southRegion.id,
    availability: [{ dayOfWeek: 6, startMinute: 600, endMinute: 720 }], // Saturday 10:00-12:00
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
        styleScore: 1,
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

  return {
    dana,
    yossi,
    noa,
    avi,
    maya,
    ronit,
    eitan,
    tal,
    shira,
    omer,
    liat,
    boaz,
    tamar,
    guy,
    hila,
    michal,
    nadav,
    eligibleGroup,
    conflictedGroup,
  };
}
