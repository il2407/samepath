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

const avatarPalette = ["bg-mint text-primary-dark", "bg-sand text-calm-dark", "bg-happy/40 text-happy-dark"];

const statusStyles: Record<string, string> = {
  DRAFT: "bg-warm-surface text-muted",
  PENDING_REVIEW: "bg-sand text-calm-dark",
  NEEDS_CHANGES: "bg-danger/10 text-danger",
  APPROVED: "bg-mint text-primary-dark",
  SCHEDULED_FOR_PUBLICATION: "bg-happy/40 text-happy-dark",
  PUBLISHED: "bg-mint text-primary-dark",
  REJECTED: "bg-danger/10 text-danger",
  REMOVED: "bg-warm-surface text-muted",
  WITHDRAWN_BY_AUTHOR: "bg-warm-surface text-muted",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
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
      {contributions.map((c, i) => (
        <div key={c.id} className="flex items-start gap-4 rounded-2xl border border-border bg-white p-5">
          <span
            aria-hidden
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarPalette[i % avatarPalette.length]}`}
          >
            {initialsOf(c.companyName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-semibold text-ink">{c.companyName}</p>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[c.status] ?? "bg-paper text-muted"}`}
              >
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
        </div>
      ))}
    </div>
  );
}
