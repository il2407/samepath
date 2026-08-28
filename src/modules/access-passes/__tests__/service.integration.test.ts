import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import {
  checkAndActivateAccessGate,
  createPendingAccessPass,
  getAccessStatus,
  grantReplacementAccessPass,
} from "@/modules/access-passes/service";

beforeEach(async () => {
  await resetTestDatabase();
});

async function fakePaymentAndProduct(userId: string) {
  const product = await prisma.productConfiguration.create({
    data: { key: `standard-pass-${userId}`, name: "גישה ל-45 יום", priceCents: 14900, accessDurationDays: 45 },
  });
  const payment = await prisma.payment.create({
    data: {
      userId,
      productConfigId: product.id,
      amountCents: product.priceCents,
      status: "PAID",
      idempotencyKey: `test-payment-${userId}-${Date.now()}`,
    },
  });
  return { payment, product };
}

describe("checkAndActivateAccessGate", () => {
  it("fails for a user with no access pass at all", async () => {
    const user = await createTestUser();
    expect(await checkAndActivateAccessGate(user.user.id, "FIRST_MUTUAL_CONNECTION")).toBe(false);
  });

  it("passes trivially for a user who already has an active pass", async () => {
    const user = await createTestUser();
    await prisma.accessPass.create({
      data: { userId: user.user.id, status: "ACTIVE", durationDays: 45, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) },
    });
    expect(await checkAndActivateAccessGate(user.user.id, "FIRST_MUTUAL_CONNECTION")).toBe(true);
  });

  it("activates a pending (paid) pass at the moment of the event, starting the clock now", async () => {
    const user = await createTestUser();
    const { payment, product } = await fakePaymentAndProduct(user.user.id);
    const pending = await createPendingAccessPass(user.user.id, payment.id, product.id, 45);
    expect(pending.status).toBe("PENDING_ACTIVATION");

    const before = Date.now();
    const result = await checkAndActivateAccessGate(user.user.id, "FIRST_GROUP_JOIN");
    expect(result).toBe(true);

    const activated = await prisma.accessPass.findUniqueOrThrow({ where: { id: pending.id } });
    expect(activated.status).toBe("ACTIVE");
    expect(activated.activationEventType).toBe("FIRST_GROUP_JOIN");
    expect(activated.activatedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(activated.expiresAt!.getTime()).toBeGreaterThan(activated.activatedAt!.getTime());

    const event = await prisma.accessPassEvent.findFirstOrThrow({
      where: { accessPassId: pending.id, type: "ACTIVATED" },
    });
    expect(event).not.toBeNull();
  });

  it("treats a past-expiry ACTIVE pass as expired rather than passing", async () => {
    const user = await createTestUser();
    await prisma.accessPass.create({
      data: { userId: user.user.id, status: "ACTIVE", durationDays: 45, expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await checkAndActivateAccessGate(user.user.id, "FIRST_MUTUAL_CONNECTION")).toBe(false);

    const pass = await prisma.accessPass.findFirstOrThrow({ where: { userId: user.user.id } });
    expect(pass.status).toBe("EXPIRED");
  });
});

describe("getAccessStatus", () => {
  it("reports no active pass and no pending pass for a brand-new user", async () => {
    const user = await createTestUser();
    const status = await getAccessStatus(user.user.id);
    expect(status).toEqual({ hasActivePass: false, expiresAt: null, daysRemaining: null, pendingPass: false });
  });

  it("reports a pending purchase distinctly from an active pass", async () => {
    const user = await createTestUser();
    const { payment, product } = await fakePaymentAndProduct(user.user.id);
    await createPendingAccessPass(user.user.id, payment.id, product.id, 45);
    const status = await getAccessStatus(user.user.id);
    expect(status.hasActivePass).toBe(false);
    expect(status.pendingPass).toBe(true);
  });

  it("reports days remaining for an active pass", async () => {
    const user = await createTestUser();
    await prisma.accessPass.create({
      data: {
        userId: user.user.id,
        status: "ACTIVE",
        durationDays: 45,
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    });
    const status = await getAccessStatus(user.user.id);
    expect(status.hasActivePass).toBe(true);
    expect(status.daysRemaining).toBeGreaterThanOrEqual(9);
  });
});

describe("grantReplacementAccessPass", () => {
  it("extends an existing active pass without a new purchase", async () => {
    const user = await createTestUser();
    const originalExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const pass = await prisma.accessPass.create({
      data: { userId: user.user.id, status: "ACTIVE", durationDays: 45, expiresAt: originalExpiry },
    });

    await grantReplacementAccessPass(user.user.id, "other party never responded", 14);

    const updated = await prisma.accessPass.findUniqueOrThrow({ where: { id: pass.id } });
    expect(updated.expiresAt!.getTime()).toBeGreaterThan(originalExpiry.getTime());

    const event = await prisma.accessPassEvent.findFirstOrThrow({
      where: { accessPassId: pass.id, type: "REPLACEMENT_GRANTED" },
    });
    expect(event.metadata).toMatchObject({ reason: "other party never responded" });
  });

  it("grants a short free pass when the user has none active", async () => {
    const user = await createTestUser();
    await grantReplacementAccessPass(user.user.id, "no-show", 10);

    const pass = await prisma.accessPass.findFirstOrThrow({ where: { userId: user.user.id } });
    expect(pass.status).toBe("ACTIVE");
    expect(pass.isReplacement).toBe(true);
  });
});
