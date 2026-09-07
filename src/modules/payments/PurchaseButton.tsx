"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { purchaseAccessPassAction } from "@/modules/payments/actions";

export function PurchaseButton({ productKey, label }: { productKey: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handlePurchase() {
    setError(null);
    startTransition(async () => {
      const result = await purchaseAccessPassAction(productKey);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Button onClick={handlePurchase} disabled={pending} className="px-5 py-2.5 text-sm">
        {pending ? "מעבד…" : label}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
