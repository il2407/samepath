"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { withdrawContributionAction } from "@/modules/interviews/actions";
import { experienceStatusLabels } from "@/modules/interviews/labels";

export interface ContributionRow {
  id: string;
  companyName: string;
  status: string;
  questionCount: number;
  createdAt: string;
  revisionMessage: string | null;
}

export function ContributionsList({ contributions }: { contributions: ContributionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleWithdraw(id: string) {
    startTransition(async () => {
      await withdrawContributionAction(id);
      router.refresh();
    });
  }

  if (contributions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
        עדיין לא שיתפתם חוויית ראיון.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contributions.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-ink">{c.companyName}</p>
            <span className="rounded-full bg-paper px-3 py-1 text-xs text-muted">
              {experienceStatusLabels[c.status] ?? c.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{c.questionCount} שאלות</p>
          {c.revisionMessage && (
            <p className="mt-2 rounded-lg bg-warm-surface px-3 py-2 text-sm text-ink">הערת מודרציה: {c.revisionMessage}</p>
          )}
          {c.status !== "WITHDRAWN_BY_AUTHOR" && c.status !== "REMOVED" && (
            <button
              type="button"
              onClick={() => handleWithdraw(c.id)}
              disabled={pending}
              className="mt-3 text-sm text-muted hover:text-danger"
            >
              משיכת התרומה
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
