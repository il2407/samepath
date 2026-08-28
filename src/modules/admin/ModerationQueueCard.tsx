"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveContributionAction,
  rejectContributionAction,
  removeContributionAction,
  requestChangesAction,
} from "@/modules/admin/moderation-actions";
import type { ModerationQueueItem } from "@/modules/moderation/interviews";

export function ModerationQueueCard({ item }: { item: ModerationQueueItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [publicationDelay, setPublicationDelay] = useState(14);
  const [changesMessage, setChangesMessage] = useState("");
  const [showChanges, setShowChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveContributionAction(item.id, publicationDelay);
      if (!result.ok) setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }
  function submitChanges() {
    startTransition(async () => {
      const result = await requestChangesAction({ experienceId: item.id, message: changesMessage });
      if (!result.ok) setError(result.error ?? "משהו השתבש");
      setShowChanges(false);
      router.refresh();
    });
  }
  function reject() {
    startTransition(async () => {
      await rejectContributionAction({ experienceId: item.id });
      router.refresh();
    });
  }
  function remove() {
    startTransition(async () => {
      await removeContributionAction({ experienceId: item.id, reason: "moderator removal", reverseReward: false });
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">{item.companyName}</p>
        <span className="text-xs text-muted">
          {item.periodYear} רבעון {item.periodQuarter} · {item.questionCount} שאלות
        </span>
      </div>
      <p className="mt-2 text-sm text-ink/80">{item.processDescription}</p>

      {(item.contentWarnings.length > 0 || item.likelyDuplicateQuestions > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {item.contentWarnings.map((w) => (
            <span key={w} className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
              אזהרה אוטומטית: {w}
            </span>
          ))}
          {item.likelyDuplicateQuestions > 0 && (
            <span className="rounded-full bg-warm-surface px-2.5 py-1 text-ink">
              {item.likelyDuplicateQuestions} שאלות דומות לקיימות
            </span>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="number"
          value={publicationDelay}
          onChange={(e) => setPublicationDelay(Number(e.target.value))}
          className="w-20 rounded-lg border border-border px-2 py-1.5 text-sm"
          aria-label="עיכוב פרסום בימים"
        />
        <span className="text-xs text-muted">ימי עיכוב פרסום</span>
        <button
          type="button"
          onClick={approve}
          disabled={pending}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          אישור
        </button>
        <button
          type="button"
          onClick={() => setShowChanges((v) => !v)}
          disabled={pending}
          className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-primary"
        >
          בקשת שינויים
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={pending}
          className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-primary"
        >
          דחייה
        </button>
        <button type="button" onClick={remove} disabled={pending} className="rounded-full px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
          הסרה
        </button>
      </div>

      {showChanges && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-paper p-3">
          <textarea
            value={changesMessage}
            onChange={(e) => setChangesMessage(e.target.value)}
            placeholder="מה נדרש לתקן? (הודעה זו תוצג לתורם/ת)"
            rows={2}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={submitChanges}
            disabled={pending || !changesMessage.trim()}
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            שליחת בקשת שינויים
          </button>
        </div>
      )}
    </div>
  );
}
