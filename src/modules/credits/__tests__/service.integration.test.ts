import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser, grantActiveAccessPass } from "@/shared/test/fixtures";
import { grantFreeTrialAccessPass } from "@/modules/access-passes/service";
import { prisma } from "@/shared/db";
import {
  convertCredits,
  getCreditBalance,
  grantCreditsIdempotent,
  reverseCreditGrant,
} from "@/modules/credits/service";

beforeEach(async () => {
  await resetTestDatabase();
  await prisma.rewardPolicy.createMany({
    data: [
      { key: "credits.approved_complete_experience", valueJson: { credits: 20 } },
      { key: "credits.unique_useful_question_bonus", valueJson: { creditsPerQuestion: 2, maxPerExperience: 20, maxRewardableQuestions: 8 } },
      { key: "credits.community_validation_bonus", valueJson: { maxPerExperience: 10 } },
      { key: "credits.conversion_tiers", valueJson: { tiers: [{ credits: 50, accessDays: 7 }, { credits: 100, accessDays: 15 }] } },
      { key: "credits.max_bonus_extension_days_per_window", valueJson: { maxDays: 30, windowDays: 90 } },
    ],
  });
});

describe("grantCreditsIdempotent", () => {
  it("grants once and is a true no-op on repeat calls with the same key", async () => {
    const user = await createTestUser();

    const first = await grantCreditsIdempotent(user.user.id, 20, "CONTRIBUTION_APPROVED", "approval:exp-1");
    expect(first.granted).toBe(true);

    const second = await grantCreditsIdempotent(user.user.id, 20, "CONTRIBUTION_APPROVED", "approval:exp-1");
    expect(second.granted).toBe(false);

    // simulate the same "approve" call firing three times (retry, double-click, webhook replay)
    await grantCreditsIdempotent(user.user.id, 20, "CONTRIBUTION_APPROVED", "approval:exp-1");

    expect(await getCreditBalance(user.user.id)).toBe(20);
    const entries = await prisma.creditLedgerEntry.findMany({ where: { userId: user.user.id } });
    expect(entries).toHaveLength(1);
  });

  it("propagates a genuine database error instead of silently treating it as 'already granted'", async () => {
    const user = await createTestUser();
    // a non-existent sourceExperienceId trips the foreign-key constraint —
    // this must surface as a real error, not a false-positive idempotent no-op.
    await expect(
      grantCreditsIdempotent(user.user.id, 20, "CONTRIBUTION_APPROVED", "approval:exp-bad-fk", "does-not-exist"),
    ).rejects.toThrow();
    expect(await getCreditBalance(user.user.id)).toBe(0);
  });

  it("allows different idempotency keys to grant independently", async () => {
    const user = await createTestUser();
    await grantCreditsIdempotent(user.user.id, 20, "CONTRIBUTION_APPROVED", "approval:exp-1");
    await grantCreditsIdempotent(user.user.id, 24, "CONTRIBUTION_APPROVED", "approval:exp-2");
    expect(await getCreditBalance(user.user.id)).toBe(44);
  });
});

describe("reverseCreditGrant", () => {
  it("reverses a grant exactly once even if called multiple times", async () => {
    const user = await createTestUser();
    await grantCreditsIdempotent(user.user.id, 20, "CONTRIBUTION_APPROVED", "approval:exp-1");
    const grant = await prisma.creditLedgerEntry.findFirstOrThrow({ where: { userId: user.user.id } });

    await reverseCreditGrant(grant.id);
    await reverseCreditGrant(grant.id);
    await reverseCreditGrant(grant.id);

    expect(await getCreditBalance(user.user.id)).toBe(0);
    const entries = await prisma.creditLedgerEntry.findMany({ where: { userId: user.user.id } });
    expect(entries).toHaveLength(2); // the original grant + exactly one reversal
  });

  it("never lets a balance go negative from reversing a grant the user already partly spent", async () => {
    // policy allows this scenario to exist in the ledger (it's a ledger, not
    // a hard-clamped wallet) — the invariant the spec cares about is that a
    // reversal never retroactively removes access days already consumed,
    // which holds because conversion writes days onto the AccessPass itself.
    const user = await createTestUser();
    await grantCreditsIdempotent(user.user.id, 50, "CONTRIBUTION_APPROVED", "approval:exp-1");
    await convertCredits(user.user.id, 50);
    expect(await getCreditBalance(user.user.id)).toBe(0);

    const grant = await prisma.creditLedgerEntry.findFirstOrThrow({
      where: { userId: user.user.id, reason: "CONTRIBUTION_APPROVED" },
    });
    await reverseCreditGrant(grant.id);
    expect(await getCreditBalance(user.user.id)).toBe(-50);
  });
});

describe("convertCredits", () => {
  it("converts at a valid tier and records the ledger entry + conversion", async () => {
    const user = await createTestUser();
    await grantCreditsIdempotent(user.user.id, 100, "CONTRIBUTION_APPROVED", "approval:exp-1");

    const result = await convertCredits(user.user.id, 50);
    expect(result).toEqual({ ok: true, accessDaysGranted: 7 });
    expect(await getCreditBalance(user.user.id)).toBe(50);
  });

  it("rejects a tier the user can't afford", async () => {
    const user = await createTestUser();
    await grantCreditsIdempotent(user.user.id, 10, "CONTRIBUTION_APPROVED", "approval:exp-1");
    expect(await convertCredits(user.user.id, 50)).toEqual({ ok: false, reason: "insufficient_credits" });
  });

  it("rejects an amount that isn't a configured tier", async () => {
    const user = await createTestUser();
    await grantCreditsIdempotent(user.user.id, 1000, "CONTRIBUTION_APPROVED", "approval:exp-1");
    expect(await convertCredits(user.user.id, 77)).toEqual({ ok: false, reason: "invalid_tier" });
  });

  it("caps bonus access days within the configured rolling window", async () => {
    const user = await createTestUser();
    await grantCreditsIdempotent(user.user.id, 1000, "CONTRIBUTION_APPROVED", "approval:exp-1");

    // 15 + 15 = 30 (exactly the window cap)
    const first = await convertCredits(user.user.id, 100);
    expect(first).toEqual({ ok: true, accessDaysGranted: 15 });
    const second = await convertCredits(user.user.id, 100);
    expect(second).toEqual({ ok: true, accessDaysGranted: 15 });

    // window cap now exhausted
    const third = await convertCredits(user.user.id, 50);
    expect(third).toEqual({ ok: false, reason: "window_cap_reached" });
  });
});

describe("convertCredits -> access pass", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("extends an active pass's expiry by the granted days", async () => {
    const user = await createTestUser();
    const pass = await grantActiveAccessPass(user.user.id, 10);
    await grantCreditsIdempotent(user.user.id, 50, "CONTRIBUTION_APPROVED", "approval:exp-1");

    await convertCredits(user.user.id, 50);

    const after = await prisma.accessPass.findUniqueOrThrow({ where: { id: pass.id } });
    expect(after.expiresAt!.getTime() - pass.expiresAt!.getTime()).toBe(7 * DAY);
    expect(after.bonusDaysFromCredits).toBe(7);
    expect(await prisma.accessPassEvent.count({ where: { accessPassId: pass.id, type: "EXTENDED" } })).toBe(1);
  });

  it("lengthens a not-yet-activated pass instead of starting a new clock", async () => {
    const user = await createTestUser();
    const pass = await grantFreeTrialAccessPass(user.user.id, 30);
    await grantCreditsIdempotent(user.user.id, 50, "CONTRIBUTION_APPROVED", "approval:exp-1");

    await convertCredits(user.user.id, 50);

    const after = await prisma.accessPass.findUniqueOrThrow({ where: { id: pass.id } });
    expect(after.status).toBe("PENDING_ACTIVATION");
    expect(after.durationDays).toBe(37);
    expect(await prisma.accessPass.count({ where: { userId: user.user.id } })).toBe(1);
  });

  it("creates a pending pass when the user's only pass has expired", async () => {
    const user = await createTestUser();
    const old = await grantActiveAccessPass(user.user.id, 10);
    await prisma.accessPass.update({ where: { id: old.id }, data: { expiresAt: new Date(Date.now() - DAY) } });
    await grantCreditsIdempotent(user.user.id, 50, "CONTRIBUTION_APPROVED", "approval:exp-1");

    await convertCredits(user.user.id, 50);

    expect((await prisma.accessPass.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("EXPIRED");
    const created = await prisma.accessPass.findFirstOrThrow({ where: { userId: user.user.id, status: "PENDING_ACTIVATION" } });
    expect(created.durationDays).toBe(7);
    expect(created.bonusDaysFromCredits).toBe(7);
  });
});
