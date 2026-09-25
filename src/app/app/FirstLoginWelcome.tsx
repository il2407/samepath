"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/Button";

/**
 * One-time modal shown right after onboarding completes (confirmOnboardingAction
 * redirects to /app?welcome=1&matches=<count>, <count> being the return value of
 * that same synchronous generateSuggestionsForUser call). Suggestions already
 * exist by this point, so when matchCount > 0 this leads with that instead of
 * just orienting the user. Dismissing it strips both query params via
 * router.replace so a refresh (or coming back later) never shows it again;
 * nothing is persisted server-side for this since the query param already
 * makes it strictly one-time-per-redirect.
 */
export function FirstLoginWelcome({
  matchCount,
  pendingApproval = false,
}: {
  matchCount: number;
  /** Account still awaiting team approval — no matches are generated until then. */
  pendingApproval?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) router.replace("/app");
  }, [open, router]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-login-welcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="max-w-sm rounded-2xl border border-border bg-white p-6 shadow-lg">
        <h2 id="first-login-welcome-title" className="text-lg font-bold text-ink">
          {pendingApproval
            ? "הפרופיל שלכם מוכן!"
            : matchCount > 0
              ? `נמצאו ${matchCount} התאמות חדשות!`
              : "הפרופיל שלכם פעיל!"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {pendingApproval
            ? "החשבון ממתין כעת לאישור הצוות. ברגע שיאושר נעדכן אתכם במייל ובהתראה כאן, ותתחילו לקבל התאמות."
            : matchCount > 0
            ? "כבר התחלנו לחפש עבורכם התאמות, ומצאנו כמה שכדאי להכיר. עד שתבחרו להיחשף, תופיעו בפני אחרים רק בכינוי ואייקון אנונימיים."
            : "כבר התחלנו לחפש עבורכם התאמות. עד שתבחרו להיחשף, תופיעו בפני אחרים רק בכינוי ואייקון אנונימיים."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} className="px-4 py-2 text-sm">
            הבנתי
          </Button>
          {matchCount > 0 && (
            <Button onClick={() => router.replace("/app/matches")} className="px-4 py-2 text-sm">
              קדימה להתאמה!
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
