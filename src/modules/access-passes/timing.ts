// Pure access-pass date math (spec §10). No DB.

export function computeExpiryDate(activatedAt: Date, durationDays: number): Date {
  const expiry = new Date(activatedAt);
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry;
}

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return !!expiresAt && expiresAt.getTime() <= now.getTime();
}

export function daysRemaining(expiresAt: Date | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** True once the pass is within the reminder window but hasn't expired yet. */
export function needsExpiryReminder(expiresAt: Date | null, now: Date, reminderThresholdDays: number): boolean {
  const remaining = daysRemaining(expiresAt, now);
  return remaining !== null && remaining > 0 && remaining <= reminderThresholdDays;
}
