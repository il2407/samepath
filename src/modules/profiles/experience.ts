// Pure experience-calculation logic — no DB, no framework imports. Used by
// both manual profile entry and (later) resume extraction, so overlapping
// jobs are never double-counted regardless of how the positions arrived.

export interface DateRange {
  start: Date;
  end: Date;
}

/** Merges overlapping or touching ranges. Input order doesn't matter. */
export function mergeDateRanges(ranges: DateRange[]): DateRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: DateRange[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) last.end = current.end;
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** Whole completed months between two dates (day-of-month aware, not calendar-rounded). */
export function monthsBetween(start: Date, end: Date): number {
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  return end.getUTCDate() >= start.getUTCDate() ? months : months - 1;
}

export interface EmploymentPeriod {
  startDate: Date;
  /** null means "current" (ongoing as of `asOf`). */
  endDate: Date | null;
}

/**
 * Total experience across all positions, with overlapping employment
 * periods merged first so concurrent jobs (e.g. a side project alongside a
 * full-time role) are never added together into inflated experience.
 */
export function calculateExperienceMonths(positions: EmploymentPeriod[], asOf: Date = new Date()): number {
  const ranges = positions
    .map((p) => ({ start: p.startDate, end: p.endDate ?? asOf }))
    .filter((r) => r.end.getTime() >= r.start.getTime());
  const merged = mergeDateRanges(ranges);
  return merged.reduce((total, range) => total + monthsBetween(range.start, range.end), 0);
}

export interface SeniorityBandRange {
  code: string;
  minMonths: number;
  maxMonths: number | null;
}

/** Finds the band whose [minMonths, maxMonths] range contains `months`, clamping at the edges. */
export function deriveSeniorityBandCode(months: number, bands: SeniorityBandRange[]): string | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.minMonths - b.minMonths);

  for (const band of sorted) {
    if (months >= band.minMonths && (band.maxMonths === null || months <= band.maxMonths)) {
      return band.code;
    }
  }
  if (months < sorted[0].minMonths) return sorted[0].code;
  return sorted[sorted.length - 1].code;
}
