/**
 * Collapses several extracted roles at the same company into one entry, so
 * the review card lists each previous employer once (a promotion from
 * Developer to Team Lead at one company is still one company). Pure — no DB,
 * safe to call from the onboarding page or a test.
 *
 * Grouping key is the resolved companyId, falling back to a normalized name
 * for the (rare) rows the parser couldn't resolve. The merged entry spans the
 * earliest start to the latest end (null = still there) and keeps the title
 * of the most recent role. If any role in the group is current, the merged
 * entry is current and keeps the current role's title — earlier roles at the
 * current employer fold into it rather than showing up as a "previous" job.
 */
export interface DedupablePosition {
  companyId: string;
  companyName: string;
  title: string;
  startMonth: string;
  endMonth: string | null;
  isCurrent: boolean;
}

function companyKey(p: DedupablePosition): string {
  return p.companyId || p.companyName.trim().toLowerCase().replace(/\s+/g, " ");
}

/** "YYYY-MM" compares lexically; null end means "until today", i.e. latest. */
function laterEnd(a: string | null, b: string | null): string | null {
  if (a === null || b === null) return null;
  return a > b ? a : b;
}

/** Earliest non-empty "YYYY-MM"; an unparsed (empty) start never wins. */
function earlierStart(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function isMoreRecent(a: DedupablePosition, b: DedupablePosition): boolean {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent;
  const aEnd = a.endMonth ?? "9999-99";
  const bEnd = b.endMonth ?? "9999-99";
  if (aEnd !== bEnd) return aEnd > bEnd;
  return a.startMonth > b.startMonth;
}

export function dedupePositionsByCompany<T extends DedupablePosition>(positions: T[]): T[] {
  const groups = new Map<string, T>();
  for (const p of positions) {
    const key = companyKey(p);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...p });
      continue;
    }
    const recent = isMoreRecent(p, existing) ? p : existing;
    groups.set(key, {
      ...recent,
      startMonth: earlierStart(p.startMonth, existing.startMonth),
      endMonth: recent.isCurrent ? null : laterEnd(p.endMonth, existing.endMonth),
      isCurrent: p.isCurrent || existing.isCurrent,
    });
  }
  return [...groups.values()];
}
