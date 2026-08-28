"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { deleteAccountAction, pauseProfileAction, resumeProfileAction } from "@/modules/account/actions";

export function AccountSettingsPanel({ isPaused }: { isPaused: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function togglePause() {
    startTransition(async () => {
      if (isPaused) await resumeProfileAction();
      else await pauseProfileAction();
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteAccountAction();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white p-6">
        <h2 className="font-semibold text-ink">השהיית פרופיל</h2>
        <p className="mt-2 text-sm text-muted">
          כשהפרופיל מושהה לא תקבלו הצעות התאמה חדשות ולא תופיעו בפני אחרים. אפשר לחדש בכל רגע.
        </p>
        <Button variant="secondary" onClick={togglePause} disabled={pending} className="mt-3 px-4 py-2 text-sm">
          {isPaused ? "חידוש הפרופיל" : "השהיית הפרופיל"}
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-white p-6">
        <h2 className="font-semibold text-ink">ייצוא נתונים</h2>
        <p className="mt-2 text-sm text-muted">הורדת עותק של כל המידע השמור עליכם בפורמט JSON.</p>
        <a
          href="/api/account/export"
          className="mt-3 inline-flex items-center justify-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink hover:border-primary"
        >
          הורדת הנתונים שלי
        </a>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-800">מחיקת חשבון</h2>
        <p className="mt-2 text-sm text-red-700">
          פעולה זו סופית. החשבון ייחסם לכניסה, ופרטים מזהים (שם מלא, טלפון, LinkedIn) יימחקו. תרומות
          שפורסמו בספריית הראיונות יישארו אנונימיות בקהילה, כפי שהן היום.
        </p>
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-3 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            מחיקת החשבון שלי
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-red-700">כדי לאשר, הקלידו &quot;מחיקה&quot; בשדה למטה.</p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full max-w-xs rounded-xl border border-red-300 bg-white px-4 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={confirmText !== "מחיקה" || pending}
                onClick={handleDelete}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                אישור מחיקה סופית
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmText("");
                }}
                className="rounded-full px-4 py-2 text-sm text-muted hover:text-ink"
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
