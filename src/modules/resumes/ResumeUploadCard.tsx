"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadResumeAction, retryResumeExtractionAction } from "@/modules/resumes/actions";
import type { ExtractionFailureReason } from "@/modules/resumes/service";
import { CvVerifiedBadge } from "@/shared/ui/CvVerifiedBadge";

/**
 * Uploading, malware-scanning and text-extraction all happen inline in one
 * request (see resumes/service.ts's uploadResume) — there's no real
 * step-by-step progress channel. These labels advance on a timer purely so
 * the button reflects what's actually happening in that request's order
 * (scan, then extract) instead of sitting on one static "uploading" label
 * for however long the whole thing takes.
 */
const UPLOAD_STAGE_LABELS = ["מעלה את הקובץ…", "סורק את הקובץ…", "מחלץ פרטים רלוונטיים…"];

export function ResumeUploadCard({
  extractionFailed,
  extractionFailureReason = null,
  failedUploadId,
}: {
  extractionFailed: boolean;
  /** Which kind of failure — lets the message and the retry option be specific instead of generic. Optional for backward compatibility with callers that haven't been updated to pass it. */
  extractionFailureReason?: ExtractionFailureReason | null;
  /** The upload to retry extraction against, when extractionFailed is true. Omitted (or extractionFailed false) hides the retry button. */
  failedUploadId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const stageTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [pending, startTransition] = useTransition();
  const [retrying, startRetryTransition] = useTransition();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => () => stageTimeouts.current.forEach(clearTimeout), []);

  function handleRetry() {
    if (!failedUploadId) return;
    setRetryError(null);
    startRetryTransition(async () => {
      const result = await retryResumeExtractionAction(failedUploadId);
      if (!result.ok) {
        setRetryError(result.error ?? "משהו השתבש");
        return;
      }
      router.refresh();
    });
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setStage(0);
    stageTimeouts.current.forEach(clearTimeout);
    stageTimeouts.current = [setTimeout(() => setStage(1), 700), setTimeout(() => setStage(2), 2200)];

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadResumeAction(formData);
      stageTimeouts.current.forEach(clearTimeout);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        setFileName(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-dashed border-primary/40 bg-mint/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-ink">מעדיפים להעלות קורות חיים?</h2>
        <CvVerifiedBadge />
      </div>
      <p className="mt-1.5 text-sm font-medium text-happy-dark">
        מי שמעלה ומאשר קורות חיים מקבל/ת את התג הזה — מעיד על אמינות הפרופיל בעיני מועמדים אחרים בהצעות התאמה.
      </p>
      <p className="mt-1.5 text-sm text-muted">
        נחלץ באופן אוטומטי טיוטה של תפקידים, חברות וכישורים — תעברו עליה, תערכו הכל כרצונכם, ורק
        אחרי אישורכם היא נשמרת בפרופיל. קובץ ה-PDF/Word עצמו נמחק לאחר האישור, אלא אם תבחרו לשמור
        אותו. גם ככה תמיד אפשר למלא הכל ידנית למטה.
      </p>
      <p className="mt-1.5 text-sm text-muted">
        הקובץ והמידע שנחלץ ממנו נשמרים אך ורק במערכת שלנו — לא נשלחים לשום שירות צד־שלישי ולא
        נחשפים לאף חברה או סוכנות.
      </p>
      {extractionFailed && (
        <div className="mt-2 rounded-xl bg-warm-surface px-3 py-2 text-sm text-ink">
          <p>
            {extractionFailureReason === "EMPTY_TEXT"
              ? "נראה שזהו קובץ סרוק (תמונה) ולא טקסט הניתן לקריאה — אי אפשר לחלץ ממנו מידע אוטומטית. אפשר להעלות קובץ שנוצר ישירות כטקסט (למשל ייצוא PDF מוורד), או למלא את הטופס ידנית למטה."
              : "לא הצלחנו לחלץ מידע מהקובץ שהעליתם בפעם הקודמת. אפשר לנסות שוב, להעלות קובץ אחר, או למלא ידנית למטה."}
          </p>
          {/* Retrying the same file for an EMPTY_TEXT failure would fail identically every time — there's no text layer to find — so the retry option only makes sense for other, possibly-transient failures. */}
          {failedUploadId && extractionFailureReason !== "EMPTY_TEXT" && (
            <button
              type="button"
              disabled={retrying}
              onClick={handleRetry}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark disabled:opacity-50"
            >
              {retrying && <Spinner />}
              {retrying ? "מנסה שוב…" : "ניסיון חוזר לחילוץ מאותו הקובץ"}
            </button>
          )}
          {retryError && <p className="mt-1 text-sm text-danger">{retryError}</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept=".pdf,.docx" onChange={handleFileSelected} className="hidden" />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pending && <Spinner />}
          {pending ? UPLOAD_STAGE_LABELS[stage] : "בחירת קובץ להעלאה"}
        </button>
        <span className="text-xs text-muted">{pending && fileName ? fileName : "PDF או Word, עד 5MB"}</span>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}
