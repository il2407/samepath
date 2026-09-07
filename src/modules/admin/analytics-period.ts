/**
 * Pure logic only — no DB, no framework import (matches this codebase's
 * "pure logic files are fully unit-testable, safe to import anywhere"
 * convention, see README.md's Architecture section). Split out of
 * analytics.ts specifically so its tests don't transitively pull in
 * @/shared/db (which analytics.ts does, via "server-only" + prisma) just to
 * exercise this query-string parsing.
 */

/** Selectable "new activity in the last N days" windows for the admin
 * analytics dashboard's period filter. Kept intentionally small and fixed —
 * a simple query-param selector, not a full date-range picker. */
export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export type AnalyticsPeriodDays = (typeof ANALYTICS_PERIODS)[number];
export const DEFAULT_ANALYTICS_PERIOD_DAYS: AnalyticsPeriodDays = 30;

export function parseAnalyticsPeriod(raw: string | string[] | undefined): AnalyticsPeriodDays {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return (ANALYTICS_PERIODS as readonly number[]).includes(parsed)
    ? (parsed as AnalyticsPeriodDays)
    : DEFAULT_ANALYTICS_PERIOD_DAYS;
}
