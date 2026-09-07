"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { reportContentAction, submitValidationAction } from "@/modules/interviews/actions";
import { contentReportReasonLabels, validationTypeLabels } from "@/modules/interviews/labels";

export function ExperienceDetailActions({ experienceId }: { experienceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("OTHER");
  const [reportDescription, setReportDescription] = useState("");

  function validate(type: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await submitValidationAction(experienceId, type);
      setNotice(result.ok ? "תודה על המשוב" : (result.error ?? "משהו השתבש"));
      router.refresh();
    });
  }

  function submitReport() {
    startTransition(async () => {
      const result = await reportContentAction({ experienceId, reason: reportReason, description: reportDescription });
      setNotice(result.ok ? "הדיווח נשלח" : (result.error ?? "משהו השתבש"));
      setShowReport(false);
    });
  }

  return (
    <div className="space-y-3">
      {notice && <p className="text-sm text-muted">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        {(["USEFUL", "SIMILAR_QUESTION", "OUTDATED"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => validate(type)}
            disabled={pending}
            className="rounded-full border border-border bg-white px-4 py-2 text-sm hover:border-primary"
          >
            {validationTypeLabels[type]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowReport((v) => !v)}
          disabled={pending}
          className="rounded-full px-4 py-2 text-sm text-muted hover:text-danger"
        >
          דיווח
        </button>
      </div>

      {showReport && (
        <div className="space-y-3 rounded-xl border border-border bg-paper p-4">
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            {Object.entries(contentReportReasonLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            placeholder="פרטים (אופציונלי)"
            rows={2}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
          <Button onClick={submitReport} disabled={pending} className="px-4 py-2 text-sm">
            שליחת דיווח
          </Button>
        </div>
      )}
    </div>
  );
}
