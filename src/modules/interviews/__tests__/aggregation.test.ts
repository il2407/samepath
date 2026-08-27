import { describe, expect, it } from "vitest";
import { canShowAggregateStats, recurringTopics } from "@/modules/interviews/aggregation";

describe("canShowAggregateStats", () => {
  it("hides stats from fewer than the minimum independent contributors", () => {
    expect(canShowAggregateStats(1)).toBe(false);
    expect(canShowAggregateStats(2)).toBe(false);
  });

  it("shows stats once the minimum is met", () => {
    expect(canShowAggregateStats(3)).toBe(true);
    expect(canShowAggregateStats(10)).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(canShowAggregateStats(3, 5)).toBe(false);
    expect(canShowAggregateStats(5, 5)).toBe(true);
  });
});

describe("recurringTopics", () => {
  it("excludes topics below the contributor threshold and sorts by count", () => {
    const result = recurringTopics([
      { tagId: "a", labelHe: "אלגוריתמים", count: 5 },
      { tagId: "b", labelHe: "SQL", count: 1 },
      { tagId: "c", labelHe: "עיצוב מערכות", count: 8 },
    ]);
    expect(result.map((t) => t.tagId)).toEqual(["c", "a"]);
  });
});
