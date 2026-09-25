"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Pop-up shown once when the on-entry search (searchNewSuggestionsOnVisit)
 * just created new suggestions. The matching NEW_MATCH notification is
 * already in the bell; this only makes it impossible to miss.
 */
export function NewMatchesToast({ count }: { count: number }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-border bg-white p-4 shadow-lg sm:inset-x-auto sm:end-6 sm:bottom-6"
    >
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">
          {count === 1 ? "נמצאה התאמה חדשה עבורכם" : `נמצאו ${count} התאמות חדשות עבורכם`}
        </p>
        <Link
          href="/app/matches"
          onClick={() => setOpen(false)}
          className="mt-1 inline-block text-sm font-medium text-primary hover:text-primary-dark"
        >
          לצפייה בהתאמות
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="סגירה"
        className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-mint hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
