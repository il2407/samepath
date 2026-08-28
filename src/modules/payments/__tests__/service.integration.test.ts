import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser, grantActiveAccessPass } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import { purchaseAccessPass } from "@/modules/payments/service";
import { generateSuggestionsForUser, recordMatchDecision } from "@/modules/matching/service";

beforeEach(async () => {
  await resetTestDatabase();
  await prisma.productConfiguration.create({
    data: { key: "standard-pass", name: "גישה ל-45 יום", priceCents: 14900, currency: "ILS", accessDurationDays: 45, isActive: true },
  });
});

describe("purchaseAccessPass", () => {
  it("creates a PAID payment and a PENDING_ACTIVATION pass — the clock does not start at payment time", async () => {
    const user = await createTestUser();
    const result = await purchaseAccessPass(user.user.id, "standard-pass");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pass = await prisma.accessPass.findUniqueOrThrow({ where: { id: result.accessPassId } });
    expect(pass.status).toBe("PENDING_ACTIVATION");
    expect(pass.activatedAt).toBeNull();
    expect(pass.expiresAt).toBeNull();

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: pass.paymentId! } });
    expect(payment.status).toBe("PAID");
    expect(payment.amountCents).toBe(14900);
  });

  it("rejects an unknown or inactive product", async () => {
    const user = await createTestUser();
    expect(await purchaseAccessPass(user.user.id, "does-not-exist")).toEqual({ ok: false, reason: "invalid_product" });

    await prisma.productConfiguration.update({ where: { key: "standard-pass" }, data: { isActive: false } });
    expect(await purchaseAccessPass(user.user.id, "standard-pass")).toEqual({ ok: false, reason: "invalid_product" });
  });

  it("immediately resolves a stuck ACCESS_CHECK match for the purchasing user", async () => {
    const field = await prisma.professionalField.create({ data: { code: "software-engineering", labelHe: "x", labelEn: "x" } });
    const role = await prisma.targetRole.create({ data: { code: "backend", professionalFieldId: field.id, labelHe: "x", labelEn: "x" } });

    const a = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    const b = await createTestUser({ professionalFieldId: field.id, targetRoleIds: [role.id] });
    await grantActiveAccessPass(a.user.id);
    await generateSuggestionsForUser(a.user.id);
    const suggestion = await prisma.matchSuggestion.findFirstOrThrow({ where: { userAId: a.user.id } });

    await recordMatchDecision(a.user.id, suggestion.id, "INTERESTED");
    await recordMatchDecision(b.user.id, suggestion.id, "INTERESTED");
    expect((await prisma.matchSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } })).status).toBe(
      "ACCESS_CHECK",
    );

    await purchaseAccessPass(b.user.id, "standard-pass");

    const resolved = await prisma.matchSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } });
    expect(resolved.status).toBe("ACTIVE");
    expect(await prisma.connection.count()).toBe(1);
  });
});
