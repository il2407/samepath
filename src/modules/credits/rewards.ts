// Pure reward-calculation logic (spec §9A). No DB — RewardPolicy rows are
// loaded elsewhere and passed in as plain config, so the numbers here are
// never scattered magic constants and the math is independently testable.

export interface UniqueQuestionBonusPolicy {
  creditsPerQuestion: number;
  maxPerExperience: number;
  maxRewardableQuestions: number;
}

export interface ConversionTier {
  credits: number;
  accessDays: number;
}

export interface RewardPolicyConfig {
  approvedCompleteExperienceCredits: number;
  uniqueQuestionBonus: UniqueQuestionBonusPolicy;
  communityValidationBonusMaxPerExperience: number;
  conversionTiers: ConversionTier[];
  maxBonusExtensionDaysPerWindow: number;
  bonusWindowDays: number;
}

export interface ExperienceForReward {
  isComplete: boolean;
  questionCount: number;
}

/** Credits granted on approval: a flat base for a complete experience, plus a capped per-question bonus. */
export function calculateApprovalReward(experience: ExperienceForReward, policy: RewardPolicyConfig): number {
  if (!experience.isComplete) return 0;
  const rewardableQuestions = Math.min(experience.questionCount, policy.uniqueQuestionBonus.maxRewardableQuestions);
  const bonus = Math.min(
    rewardableQuestions * policy.uniqueQuestionBonus.creditsPerQuestion,
    policy.uniqueQuestionBonus.maxPerExperience,
  );
  return policy.approvedCompleteExperienceCredits + bonus;
}

/** The conversion tiers a user can currently afford, largest first. */
export function availableConversionTiers(credits: number, tiers: ConversionTier[]): ConversionTier[] {
  return [...tiers].filter((t) => credits >= t.credits).sort((a, b) => b.credits - a.credits);
}

/**
 * Caps bonus access-days granted from credit conversions within a rolling
 * window — never lets one user extend their access indefinitely from
 * contributions alone.
 */
export function cappedBonusDays(
  requestedDays: number,
  alreadyGrantedInWindow: number,
  maxDaysPerWindow: number,
): number {
  const remaining = Math.max(0, maxDaysPerWindow - alreadyGrantedInWindow);
  return Math.min(Math.max(0, requestedDays), remaining);
}
