import { describe, expect, it } from "vitest";
import { computeExpiryDate, daysRemaining, isExpired, needsExpiryReminder } from "@/modules/access-passes/timing";

describe("computeExpiryDate", () => {
  it("adds the duration in days", () => {
    const activatedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(computeExpiryDate(activatedAt, 45).toISOString()).toBe(new Date("2026-02-15T00:00:00.000Z").toISOString());
  });
});

describe("isExpired", () => {
  it("is false for a null expiry (never activated)", () => {
    expect(isExpired(null)).toBe(false);
  });

  it("is false before the expiry date and true at/after it", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    expect(isExpired(new Date("2026-01-16T00:00:00.000Z"), now)).toBe(false);
    expect(isExpired(new Date("2026-01-15T00:00:00.000Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-01-14T00:00:00.000Z"), now)).toBe(true);
  });
});

describe("daysRemaining", () => {
  it("returns null for no expiry", () => {
    expect(daysRemaining(null)).toBeNull();
  });

  it("rounds up partial days", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-02T01:00:00.000Z"); // 25 hours away
    expect(daysRemaining(expiresAt, now)).toBe(2);
  });

  it("returns a negative number once past expiry", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    expect(daysRemaining(new Date("2026-01-05T00:00:00.000Z"), now)).toBeLessThan(0);
  });
});

describe("needsExpiryReminder", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("is false when there's no expiry", () => {
    expect(needsExpiryReminder(null, now, 7)).toBe(false);
  });

  it("is false when well outside the reminder window", () => {
    expect(needsExpiryReminder(new Date("2026-02-01T00:00:00.000Z"), now, 7)).toBe(false);
  });

  it("is true inside the reminder window", () => {
    expect(needsExpiryReminder(new Date("2026-01-05T00:00:00.000Z"), now, 7)).toBe(true);
  });

  it("is false once already expired", () => {
    expect(needsExpiryReminder(new Date("2025-12-31T00:00:00.000Z"), now, 7)).toBe(false);
  });
});
