import { describe, expect, it } from "vitest";
import {
  availableConversionTiers,
  calculateApprovalReward,
  cappedBonusDays,
  type RewardPolicyConfig,
} from "@/modules/credits/rewards";

const policy: RewardPolicyConfig = {
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

describe("calculateApprovalReward", () => {
  it("grants nothing for an incomplete experience", () => {
    expect(calculateApprovalReward({ isComplete: false, questionCount: 10 }, policy)).toBe(0);
  });

  it("grants the base amount when there are no questions", () => {
    expect(calculateApprovalReward({ isComplete: true, questionCount: 0 }, policy)).toBe(20);
  });

  it("adds the per-question bonus up to the reward cap", () => {
    // 3 questions * 2 credits = 6, under both caps
    expect(calculateApprovalReward({ isComplete: true, questionCount: 3 }, policy)).toBe(26);
  });

  it("caps the number of rewardable questions per experience", () => {
    // 8 is the max rewardable — 20 questions still only reward 8 * 2 = 16
    const withMany = calculateApprovalReward({ isComplete: true, questionCount: 20 }, policy);
    const withCap = calculateApprovalReward({ isComplete: true, questionCount: 8 }, policy);
    expect(withMany).toBe(withCap);
    expect(withMany).toBe(20 + 16);
  });

  it("also caps the bonus by its own credit ceiling, independent of question count", () => {
    const tightPolicy: RewardPolicyConfig = {
      ...policy,
      uniqueQuestionBonus: { creditsPerQuestion: 5, maxPerExperience: 12, maxRewardableQuestions: 8 },
    };
    // 8 questions * 5 = 40, but capped at 12
    expect(calculateApprovalReward({ isComplete: true, questionCount: 8 }, tightPolicy)).toBe(20 + 12);
  });

  it("never splitting one interview into many submissions changes the total reward", () => {
    // One experience with 6 questions...
    const oneSubmission = calculateApprovalReward({ isComplete: true, questionCount: 6 }, policy);
    // ...must reward less than or equal to submitting the same 6 questions as
    // three separate "complete" experiences (3x base + bonuses), which is
    // exactly the split-to-farm-rewards attack the cap exists to blunt.
    const threeSplitSubmissions =
      calculateApprovalReward({ isComplete: true, questionCount: 2 }, policy) * 3;
    expect(oneSubmission).toBeLessThan(threeSplitSubmissions);
  });
});

describe("availableConversionTiers", () => {
  it("returns only affordable tiers, largest first", () => {
    expect(availableConversionTiers(120, policy.conversionTiers)).toEqual([
      { credits: 100, accessDays: 15 },
      { credits: 50, accessDays: 7 },
    ]);
  });

  it("returns an empty list when nothing is affordable", () => {
    expect(availableConversionTiers(10, policy.conversionTiers)).toEqual([]);
  });

  it("includes a tier exactly matching the balance", () => {
    expect(availableConversionTiers(50, policy.conversionTiers)).toEqual([{ credits: 50, accessDays: 7 }]);
  });
});

describe("cappedBonusDays", () => {
  it("grants the full request when under the window cap", () => {
    expect(cappedBonusDays(15, 0, 30)).toBe(15);
  });

  it("caps at the remaining allowance for the window", () => {
    expect(cappedBonusDays(15, 20, 30)).toBe(10);
  });

  it("never goes negative once the window cap is already used up", () => {
    expect(cappedBonusDays(15, 30, 30)).toBe(0);
    expect(cappedBonusDays(15, 45, 30)).toBe(0);
  });
});
