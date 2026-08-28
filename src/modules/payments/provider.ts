import { randomUUID } from "node:crypto";
import { env } from "@/shared/env";

export interface ChargeInput {
  amountCents: number;
  currency: string;
  description: string;
}

export type ChargeResult = { success: true; providerRef: string } | { success: false; error: string };

export interface PaymentProvider {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

/**
 * Local, no-network provider for development and automated tests — always
 * succeeds immediately. A real provider (Stripe, a local processor, etc.)
 * implements this same interface and is selected only via PAYMENT_PROVIDER;
 * nothing else in the codebase needs to change to add one.
 */
class FakePaymentProvider implements PaymentProvider {
  async charge(): Promise<ChargeResult> {
    return { success: true, providerRef: `fake_${randomUUID()}` };
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    // env.PAYMENT_PROVIDER is validated (src/shared/env.ts) to only ever be
    // "fake" today — a production integration must be deliberately added
    // to both that enum and this switch together, never enabled by default.
    switch (env.PAYMENT_PROVIDER) {
      case "fake":
        provider = new FakePaymentProvider();
        break;
    }
  }
  return provider;
}
