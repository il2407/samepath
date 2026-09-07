"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { convertCreditsAction } from "@/modules/credits/actions";

export function CreditConversionPanel({ tiers }: { tiers: { credits: number; accessDays: number }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function convert(credits: number) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await convertCreditsAction(credits);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setNotice(`הומרו ${credits} קרדיטים ל-${result.accessDaysGranted} ימי גישה נוספים.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {notice && <p className="rounded-xl bg-mint px-4 py-3 text-sm text-primary-dark">{notice}</p>}
      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {tiers.map((tier) => (
          <Button key={tier.credits} variant="secondary" disabled={pending} onClick={() => convert(tier.credits)} className="px-4 py-2 text-sm">
            {tier.credits} קרדיטים ← {tier.accessDays} ימי גישה
          </Button>
        ))}
      </div>
    </div>
  );
}
