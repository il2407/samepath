import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db";
import { env } from "@/shared/env";
import { getPaymentProvider } from "@/modules/payments/provider";
import { createPendingAccessPass } from "@/modules/access-passes/service";
import { retryAccessCheckSuggestionsForUser } from "@/modules/matching/service";

export type PurchaseResult =
  | { ok: true; accessPassId: string }
  | { ok: false; reason: "invalid_product" | "payment_failed" };

export async function purchaseAccessPass(userId: string, productKey: string): Promise<PurchaseResult> {
  const product = await prisma.productConfiguration.findUnique({ where: { key: productKey } });
  if (!product || !product.isActive) return { ok: false, reason: "invalid_product" };

  const payment = await prisma.payment.create({
    data: {
      userId,
      productConfigId: product.id,
      provider: env.PAYMENT_PROVIDER,
      amountCents: product.priceCents,
      currency: product.currency,
      status: "CREATED",
      idempotencyKey: `purchase:${userId}:${product.id}:${randomUUID()}`,
    },
  });

  const chargeResult = await getPaymentProvider().charge({
    amountCents: product.priceCents,
    currency: product.currency,
    description: product.name,
  });

  if (!chargeResult.success) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return { ok: false, reason: "payment_failed" };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PAID", providerRef: chargeResult.providerRef },
  });

  const accessPass = await createPendingAccessPass(userId, payment.id, product.id, product.accessDurationDays);
  await retryAccessCheckSuggestionsForUser(userId);
  return { ok: true, accessPassId: accessPass.id };
}

export async function listMyPayments(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    include: { productConfig: true },
    orderBy: { createdAt: "desc" },
  });
}
