import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORING_WEIGHTS,
  computeScoreBreakdown,
  generateSafeReasons,
  type ScoringProfile,
} from "@/modules/matching/scoring";

function profile(overrides: Partial<ScoringProfile> = {}): ScoringProfile {
  return {
    targetRoleIds: ["backend"],
    professionalFieldId: "software-engineering",
    experienceMonths: 36,
    tagIds: ["typescript", "postgres"],
    timezone: "Asia/Jerusalem",
    connectionFormat: "BOTH",
    connectionCadence: "BOTH",
    connectionMode: "BOTH",
    availability: [{ dayOfWeek: 2, startMinute: 600, endMinute: 720 }],
    ...overrides,
  };
}

describe("computeScoreBreakdown", () => {
  it("gives a perfect score to two identical profiles", () => {
    const a = profile();
    const b = profile();
    const breakdown = computeScoreBreakdown(a, b);
    expect(breakdown.totalScore).toBeCloseTo(1, 5);
  });

  it("scores target-role overlap as the Jaccard similarity of the sets", () => {
    const a = profile({ targetRoleIds: ["backend", "fullstack"] });
    const b = profile({ targetRoleIds: ["backend"] });
    const breakdown = computeScoreBreakdown(a, b);
    expect(breakdown.targetRoleScore).toBeCloseTo(0.5, 5); // 1 shared / 2 union
  });

  it("scores professional field as binary match", () => {
    const a = profile({ professionalFieldId: "software-engineering" });
    const b = profile({ professionalFieldId: "design" });
    expect(computeScoreBreakdown(a, b).fieldScore).toBe(0);
  });

  it("decays experience proximity with distance and floors at 0", () => {
    const a = profile({ experienceMonths: 24 });
    const close = profile({ experienceMonths: 30 });
    const far = profile({ experienceMonths: 240 });
    const closeScore = computeScoreBreakdown(a, close).experienceScore;
    const farScore = computeScoreBreakdown(a, far).experienceScore;
    expect(closeScore).toBeGreaterThan(farScore);
    expect(farScore).toBe(0);
  });

  it("scores skills/domains overlap as Jaccard similarity", () => {
    const a = profile({ tagIds: ["typescript", "postgres", "docker"] });
    const b = profile({ tagIds: ["typescript"] });
    expect(computeScoreBreakdown(a, b).skillsScore).toBeCloseTo(1 / 3, 5);
  });

  it("gives a neutral 0.5 availability score across different timezones instead of penalizing", () => {
    const a = profile({ timezone: "Asia/Jerusalem" });
    const b = profile({ timezone: "America/New_York", availability: [{ dayOfWeek: 5, startMinute: 0, endMinute: 60 }] });
    expect(computeScoreBreakdown(a, b).availabilityScore).toBe(0.5);
  });

  it("is deterministic for the same inputs", () => {
    const a = profile();
    const b = profile({ targetRoleIds: ["fullstack"], experienceMonths: 50 });
    const first = computeScoreBreakdown(a, b);
    const second = computeScoreBreakdown(a, b);
    expect(first).toEqual(second);
  });

  it("respects custom weights instead of hard-coded defaults", () => {
    const a = profile({ targetRoleIds: ["backend"], professionalFieldId: "software-engineering" });
    const b = profile({ targetRoleIds: ["frontend"], professionalFieldId: "design" });
    const zeroed = computeScoreBreakdown(a, b, {
      ...DEFAULT_SCORING_WEIGHTS,
      targetRole: 0,
      professionalField: 0,
    });
    // With those two weights zeroed and no overlap on either, only the
    // remaining buckets (which DO have signal here) contribute.
    expect(zeroed.totalScore).toBeGreaterThan(0);
  });
});

describe("generateSafeReasons", () => {
  it("returns only reasons above the relevance threshold, capped, and never raw overall scores", () => {
    const breakdown = computeScoreBreakdown(profile(), profile());
    const reasons = generateSafeReasons(breakdown);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.length).toBeLessThanOrEqual(3);
    for (const reason of reasons) {
      expect(reason).toHaveProperty("labelHe");
      expect(typeof reason.labelHe).toBe("string");
      // each reason may carry its own safe per-factor percentage, but
      // nothing beyond code/labelHe/percentage — no raw totalScore or
      // privacy-gate internals leak through
      expect(Object.keys(reason).sort()).toEqual(["code", "labelHe", "percentage"]);
      expect(typeof reason.percentage).toBe("number");
      expect(reason.percentage).toBeGreaterThanOrEqual(0);
      expect(reason.percentage).toBeLessThanOrEqual(100);
    }
  });

  it("returns nothing when no sub-score clears the threshold", () => {
    const a = profile({
      targetRoleIds: ["backend"],
      professionalFieldId: "software-engineering",
      tagIds: ["a"],
      experienceMonths: 0,
    });
    const b = profile({
      targetRoleIds: ["design-lead"],
      professionalFieldId: "design",
      tagIds: ["b"],
      availability: [{ dayOfWeek: 5, startMinute: 0, endMinute: 60 }],
      experienceMonths: 240,
      connectionMode: "IN_PERSON",
      connectionCadence: "ONE_TIME",
    });
    const bModeOnline = { ...b, connectionMode: "ONLINE" as const, connectionCadence: "RECURRING" as const };
    const breakdown = computeScoreBreakdown({ ...a, connectionMode: "IN_PERSON", connectionCadence: "ONE_TIME" }, bModeOnline);
    expect(generateSafeReasons(breakdown)).toEqual([]);
  });
});
