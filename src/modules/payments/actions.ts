"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { purchaseAccessPass } from "@/modules/payments/service";

export type PurchaseState = { ok: boolean; error?: string };

const errorMessages: Record<string, string> = {
  invalid_product: "המוצר אינו זמין כרגע",
  payment_failed: "התשלום נכשל. נסו שוב",
};

export async function purchaseAccessPassAction(productKey: string): Promise<PurchaseState> {
  const user = await requireUser();
  const result = await purchaseAccessPass(user.id, productKey);
  if (!result.ok) return { ok: false, error: errorMessages[result.reason] ?? "משהו השתבש" };
  revalidatePath("/app/access");
  revalidatePath("/app");
  return { ok: true };
}
