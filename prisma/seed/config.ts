import { PrismaClient, Prisma } from "@/generated/prisma/client";

/**
 * Config-driven business rules — the spec's suggested numbers, seeded as
 * data so an admin can tune them without a deploy. These are initial
 * product assumptions, not fixed business rules (see README).
 */
export async function seedConfig(prisma: PrismaClient) {
  await prisma.productConfiguration.upsert({
    where: { key: "standard-pass" },
    update: {},
    create: {
      key: "standard-pass",
      name: "גישה ל-45 יום",
      priceCents: 14900, // 149 ILS — placeholder price, see README assumptions
      currency: "ILS",
      accessDurationDays: 45,
      isActive: true,
    },
  });

  const rewardPolicies: { key: string; valueJson: Prisma.InputJsonValue; description: string }[] = [
    {
      key: "credits.approved_complete_experience",
      valueJson: { credits: 20 },
      description: "Credits granted when a complete interview experience is approved.",
    },
    {
      key: "credits.unique_useful_question_bonus",
      valueJson: { creditsPerQuestion: 2, maxPerExperience: 20, maxRewardableQuestions: 8 },
      description: "Bonus credits per unique/useful question, capped per experience.",
    },
    {
      key: "credits.community_validation_bonus",
      valueJson: { maxPerExperience: 10 },
      description: "Later bonus once the community validates a contribution (e.g. 'I got a similar question').",
    },
    {
      key: "credits.conversion_tiers",
      valueJson: {
        tiers: [
          { credits: 50, accessDays: 7 },
          { credits: 100, accessDays: 15 },
        ],
      },
      description: "Credit-to-access-day conversion tiers.",
    },
    {
      key: "credits.max_bonus_extension_days_per_window",
      valueJson: { maxDays: 30, windowDays: 90 },
      description: "Cap on bonus access days earned from credits within a rolling window.",
    },
  ];

  for (const policy of rewardPolicies) {
    await prisma.rewardPolicy.upsert({
      where: { key: policy.key },
      update: { valueJson: policy.valueJson, description: policy.description },
      create: policy,
    });
  }
}
