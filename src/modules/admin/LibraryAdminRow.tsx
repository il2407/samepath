"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeContributionAction } from "@/modules/admin/moderation-actions";
import { unpublishExperienceForReviewAction } from "@/modules/admin/report-actions";

export function LibraryAdminRowActions({ experienceId, status }: { experienceId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState<"remove" | "unpublish" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!reason.trim()) return setError("נדרשת סיבה");
    setError(null);
    startTransition(async () => {
      const result =
        showReason === "remove"
          ? await removeContributionAction({ experienceId, reason, reverseReward: false })
          : await unpublishExperienceForReviewAction({ experienceId, reason });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      setShowReason(null);
      setReason("");
      router.refresh();
    });
  }

  if (status === "REMOVED") return <span className="text-xs text-muted">הוסר</span>;

  return (
    <div className="text-xs">
      {showReason ? (
        <div className="flex items-center gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבה" className="w-32 rounded-lg border border-border px-2 py-1" />
          <button type="button" disabled={pending} onClick={confirm} className="text-red-600 hover:underline">
            אישור
          </button>
          <button type="button" onClick={() => setShowReason(null)} className="text-muted hover:underline">
            ביטול
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          {status === "PUBLISHED" && (
            <button type="button" onClick={() => setShowReason("unpublish")} className="text-ink hover:underline">
              הסרה זמנית לבדיקה
            </button>
          )}
          <button type="button" onClick={() => setShowReason("remove")} className="text-red-600 hover:underline">
            הסרה סופית
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </div>
  );
}
