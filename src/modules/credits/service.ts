import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db";
import { cappedBonusDays, type ConversionTier, type RewardPolicyConfig } from "@/modules/credits/rewards";
import { Prisma, type CreditReason } from "@/generated/prisma/client";

const FALLBACK_POLICY: RewardPolicyConfig = {
  approvedCompleteExperienceCredits: 20,
  uniqueQuestionBonus: { creditsPerQuestion: 2, maxPerExperience: 20, maxRewardableQuestions: 8 },
  communityValidationBonusMaxPerExperience: 10,
  conversionTiers: [
    { credits: 50, accessDays: 7 },
    { credits: 100, accessDays: 15 },
  ],
  maxBonusExtensionDaysPerWindow: 30,
  bonusWindowDays: 90,
};

export async function loadRewardPolicy(): Promise<RewardPolicyConfig> {
  const rows = await prisma.rewardPolicy.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.valueJson as Record<string, unknown>]));

  const approved = byKey.get("credits.approved_complete_experience");
  const bonus = byKey.get("credits.unique_useful_question_bonus") as
    | { creditsPerQuestion?: number; maxPerExperience?: number; maxRewardableQuestions?: number }
    | undefined;
  const validation = byKey.get("credits.community_validation_bonus") as { maxPerExperience?: number } | undefined;
  const tiers = byKey.get("credits.conversion_tiers") as { tiers?: ConversionTier[] } | undefined;
  const window = byKey.get("credits.max_bonus_extension_days_per_window") as
    | { maxDays?: number; windowDays?: number }
    | undefined;

  return {
    approvedCompleteExperienceCredits:
      (approved?.credits as number | undefined) ?? FALLBACK_POLICY.approvedCompleteExperienceCredits,
    uniqueQuestionBonus: {
      creditsPerQuestion: bonus?.creditsPerQuestion ?? FALLBACK_POLICY.uniqueQuestionBonus.creditsPerQuestion,
      maxPerExperience: bonus?.maxPerExperience ?? FALLBACK_POLICY.uniqueQuestionBonus.maxPerExperience,
      maxRewardableQuestions:
        bonus?.maxRewardableQuestions ?? FALLBACK_POLICY.uniqueQuestionBonus.maxRewardableQuestions,
    },
    communityValidationBonusMaxPerExperience:
      validation?.maxPerExperience ?? FALLBACK_POLICY.communityValidationBonusMaxPerExperience,
    conversionTiers: tiers?.tiers ?? FALLBACK_POLICY.conversionTiers,
    maxBonusExtensionDaysPerWindow: window?.maxDays ?? FALLBACK_POLICY.maxBonusExtensionDaysPerWindow,
    bonusWindowDays: window?.windowDays ?? FALLBACK_POLICY.bonusWindowDays,
  };
}

export async function getCreditBalance(userId: string): Promise<number> {
  const aggregate = await prisma.creditLedgerEntry.aggregate({ where: { userId }, _sum: { amount: true } });
  return aggregate._sum.amount ?? 0;
}

export async function listLedger(userId: string) {
  return prisma.creditLedgerEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/** Idempotent by design: a repeat call with the same idempotencyKey is a no-op (unique constraint), never a double grant. */
export async function grantCreditsIdempotent(
  userId: string,
  amount: number,
  reason: CreditReason,
  idempotencyKey: string,
  sourceExperienceId?: string,
): Promise<{ granted: boolean }> {
  if (amount === 0) return { granted: false };
  try {
    await prisma.creditLedgerEntry.create({ data: { userId, amount, reason, idempotencyKey, sourceExperienceId } });
    return { granted: true };
  } catch (error) {
    // Only a unique-constraint violation on idempotencyKey means "already
    // granted" — anything else (e.g. a bad sourceExperienceId FK) is a real
    // bug and must not be silently swallowed as if it were a duplicate.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { granted: false };
    }
    throw error;
  }
}

/** Reverses a specific grant exactly once, regardless of how many times it's called. */
export async function reverseCreditGrant(originalLedgerEntryId: string): Promise<void> {
  const original = await prisma.creditLedgerEntry.findUniqueOrThrow({ where: { id: originalLedgerEntryId } });
  const reversalKey = `reversal:${original.id}`;
  await prisma.creditLedgerEntry.upsert({
    where: { idempotencyKey: reversalKey },
    update: {},
    create: {
      userId: original.userId,
      amount: -original.amount,
      reason: "REVERSAL",
      idempotencyKey: reversalKey,
      sourceExperienceId: original.sourceExperienceId,
    },
  });
}

export type ConvertCreditsResult =
  | { ok: true; accessDaysGranted: number }
  | { ok: false; reason: "invalid_tier" | "insufficient_credits" | "window_cap_reached" };

export async function convertCredits(userId: string, creditsToSpend: number): Promise<ConvertCreditsResult> {
  const policy = await loadRewardPolicy();
  const tier = policy.conversionTiers.find((t) => t.credits === creditsToSpend);
  if (!tier) return { ok: false, reason: "invalid_tier" };

  const balance = await getCreditBalance(userId);
  if (balance < creditsToSpend) return { ok: false, reason: "insufficient_credits" };

  const windowStart = new Date(Date.now() - policy.bonusWindowDays * 24 * 60 * 60 * 1000);
  const grantedInWindow = await prisma.creditConversion.aggregate({
    where: { userId, createdAt: { gte: windowStart } },
    _sum: { accessDaysGranted: true },
  });
  const alreadyGranted = grantedInWindow._sum.accessDaysGranted ?? 0;
  const daysToGrant = cappedBonusDays(tier.accessDays, alreadyGranted, policy.maxBonusExtensionDaysPerWindow);
  if (daysToGrant <= 0) return { ok: false, reason: "window_cap_reached" };

  await prisma.$transaction([
    prisma.creditLedgerEntry.create({
      data: {
        userId,
        amount: -creditsToSpend,
        reason: "CONVERSION",
        idempotencyKey: `conversion:${userId}:${Date.now()}:${randomUUID()}`,
      },
    }),
    prisma.creditConversion.create({ data: { userId, creditsSpent: creditsToSpend, accessDaysGranted: daysToGrant } }),
  ]);

  // TODO(access-passes module): extend/create the user's AccessPass by
  // daysToGrant. Recorded here in the ledger/conversion tables regardless,
  // so nothing needs to change in this function once that module lands.

  return { ok: true, accessDaysGranted: daysToGrant };
}
