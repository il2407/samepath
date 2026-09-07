import { describe, expect, it } from "vitest";
import {
  ANALYTICS_PERIODS,
  DEFAULT_ANALYTICS_PERIOD_DAYS,
  parseAnalyticsPeriod,
} from "@/modules/admin/analytics-period";

/**
 * Pure logic only (no DB import) — safe to run standalone, unlike the
 * DB-backed getAdminAnalytics tests in analytics.integration.test.ts.
 */
describe("parseAnalyticsPeriod", () => {
  it("accepts every value in ANALYTICS_PERIODS", () => {
    for (const days of ANALYTICS_PERIODS) {
      expect(parseAnalyticsPeriod(String(days))).toBe(days);
    }
  });

  it("falls back to the default for an unsupported number", () => {
    expect(parseAnalyticsPeriod("14")).toBe(DEFAULT_ANALYTICS_PERIOD_DAYS);
    expect(parseAnalyticsPeriod("365")).toBe(DEFAULT_ANALYTICS_PERIOD_DAYS);
    expect(parseAnalyticsPeriod("0")).toBe(DEFAULT_ANALYTICS_PERIOD_DAYS);
    expect(parseAnalyticsPeriod("-30")).toBe(DEFAULT_ANALYTICS_PERIOD_DAYS);
  });

  it("falls back to the default for garbage input", () => {
    expect(parseAnalyticsPeriod("not-a-number")).toBe(DEFAULT_ANALYTICS_PERIOD_DAYS);
    expect(parseAnalyticsPeriod(undefined)).toBe(DEFAULT_ANALYTICS_PERIOD_DAYS);
  });

  it("takes the first value when Next hands back a string array (repeated query param)", () => {
    expect(parseAnalyticsPeriod(["7", "90"])).toBe(7);
    expect(parseAnalyticsPeriod(["not-a-number"])).toBe(DEFAULT_ANALYTICS_PERIOD_DAYS);
  });
});
