"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateRewardPolicyAction } from "@/modules/admin/reward-policy-actions";

export function RewardPolicyEditor({ policyKey, description, valueJson }: { policyKey: string; description: string | null; valueJson: unknown }) {
  const router = useRouter();
  const [text, setText] = useState(JSON.stringify(valueJson, null, 2));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateRewardPolicyAction({ key: policyKey, valueJsonText: text });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      setNotice("נשמר");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <p className="font-mono text-sm text-ink">{policyKey}</p>
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(10, text.split("\n").length + 1)}
        dir="ltr"
        className="mt-3 w-full rounded-xl border border-border bg-paper px-3 py-2 font-mono text-xs"
      />
      {notice && <p className="mt-2 text-sm text-primary-dark">{notice}</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="mt-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {pending ? "שומר…" : "שמירה"}
      </button>
    </div>
  );
}
