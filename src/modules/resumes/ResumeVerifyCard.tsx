"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { discardResumeDraftAction, verifyResumeFromSettingsAction, type ActionState } from "@/modules/resumes/actions";
import type { StoredExtractedResumeData } from "@/modules/resumes/dto";
import { ExtractedResumeSummary } from "@/modules/resumes/ExtractedResumeSummary";

interface Option {
  id: string;
  labelHe: string;
}

/**
 * The settings-page counterpart to ResumeDraftReview: an already-active
 * profile doesn't need its fields re-entered from the draft, so this just
 * shows what was found in the file and lets the user confirm it's really
 * theirs — that confirmation is what earns the CV-verified mark (see
 * verifyResumeFromSettingsAction).
 */
export function ResumeVerifyCard({
  uploadId,
  originalFilename,
  extracted,
  skills,
  domains,
}: {
  uploadId: string;
  originalFilename: string;
  extracted: StoredExtractedResumeData;
  skills: Option[];
  domains: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result: ActionState = await verifyResumeFromSettingsAction({ uploadId });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  function discard() {
    setError(null);
    startTransition(async () => {
      const result = await discardResumeDraftAction(uploadId);
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">מצאנו את זה ב-{originalFilename}</h2>
      <p className="mt-1 text-sm text-muted">
        זה לא משנה את הפרופיל הקיים שלכם — רק מאשר שקורות החיים שהעליתם באמת שייכים לכם, ומוסיף לכם
        תג &quot;קו״ח מאומתים&quot; שמופיע בפני מועמדים אחרים.
      </p>

      <div className="mt-4 rounded-xl border border-border bg-paper p-4">
        <ExtractedResumeSummary extracted={extracted} skills={skills} domains={domains} />
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={confirm}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "מאשר/ת…" : "כן, אלה קורות החיים שלי — אישור"}
        </button>
        <button type="button" disabled={pending} onClick={discard} className="text-sm text-muted hover:text-danger">
          לא עכשיו, מחיקת הטיוטה
        </button>
      </div>
    </div>
  );
}
