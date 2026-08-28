"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadResumeAction } from "@/modules/resumes/actions";

export function ResumeUploadCard({ extractionFailed }: { extractionFailed: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return setError("יש לבחור קובץ");
    setError(null);

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadResumeAction(formData);
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-dashed border-primary/40 bg-mint/40 p-5">
      <h2 className="text-lg font-semibold text-ink">מעדיפים להעלות קורות חיים?</h2>
      <p className="mt-1 text-sm text-muted">
        נחלץ באופן אוטומטי טיוטה של תפקידים, חברות וכישורים — תעברו עליה, תערכו הכל כרצונכם, ורק
        אחרי אישורכם היא נשמרת בפרופיל. קובץ ה-PDF/Word עצמו נמחק לאחר האישור, אלא אם תבחרו לשמור
        אותו. גם ככה תמיד אפשר למלא הכל ידנית למטה.
      </p>
      {extractionFailed && (
        <p className="mt-2 rounded-xl bg-warm-surface px-3 py-2 text-sm text-ink">
          לא הצלחנו לחלץ מידע מהקובץ שהעליתם בפעם הקודמת. אפשר לנסות קובץ אחר, או למלא ידנית למטה.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept=".pdf,.docx" className="text-sm" />
        <button
          type="button"
          disabled={pending}
          onClick={handleUpload}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "מעלה…" : "העלאת קובץ"}
        </button>
        <span className="text-xs text-muted">PDF או Word, עד 5MB</span>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
