"use client";

import { useState } from "react";

/**
 * Keeps the manual profile form out of sight until someone explicitly opts
 * out of resume upload — the upload card above is the path we want most
 * people to take, and showing both at once makes the manual form read as
 * the default rather than the fallback.
 */
export function ManualEntryToggle({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="text-sm font-medium text-primary hover:text-primary-dark"
    >
      מילוי ידני במקום
    </button>
  );
}
