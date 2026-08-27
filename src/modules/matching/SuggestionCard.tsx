"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { submitMatchDecisionAction } from "@/modules/matching/actions";
import {
  connectionCadenceLabels,
  connectionFormatLabels,
  connectionModeLabels,
  connectionReasonLabels,
  reportCategoryLabels,
} from "@/modules/profiles/labels";
import type { PreMatchCandidateDTO } from "@/modules/profiles/dto";
import type { SafeReason } from "@/modules/matching/scoring";

export function SuggestionCard({
  matchSuggestionId,
  candidate,
  reasons,
  waitingOnOther,
}: {
  matchSuggestionId: string;
  candidate: PreMatchCandidateDTO;
  reasons: SafeReason[];
  waitingOnOther: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [mutual, setMutual] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState("OTHER");
  const [reportDescription, setReportDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "INTERESTED" | "NOT_NOW" | "NOT_RELEVANT" | "NEVER_AGAIN") {
    setError(null);
    startTransition(async () => {
      const result = await submitMatchDecisionAction({ matchSuggestionId, decision });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      if (result.mutuallyAccepted) {
        setMutual(true);
      } else if (decision !== "INTERESTED") {
        setDismissed(true);
      }
    });
  }

  function submitReport() {
    setError(null);
    startTransition(async () => {
      const result = await submitMatchDecisionAction({
        matchSuggestionId,
        decision: "REPORT",
        reportCategory,
        reportDescription,
      });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setDismissed(true);
    });
  }

  if (dismissed) return null;

  if (mutual) {
    return (
      <div className="rounded-2xl border border-primary bg-mint p-6 text-center">
        <p className="font-semibold text-primary-dark">התאמה הדדית! נפתח חיבור חדש.</p>
        <Link href="/app/connections" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-dark">
          למעבר לחיבורים שלי
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-mint text-lg font-semibold text-primary-dark">
            {candidate.displayName.slice(0, 1)}
          </div>
          <div>
            <p className="font-semibold text-ink">{candidate.displayName}</p>
            <p className="text-sm text-muted">
              {[candidate.professionalField, candidate.seniorityBand].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {waitingOnOther && (
          <span className="shrink-0 rounded-full bg-warm-surface px-3 py-1 text-xs font-medium text-muted">
            ממתין/ה לתשובת הצד השני
          </span>
        )}
      </div>

      {candidate.targetRoles.length > 0 && (
        <p className="mt-3 text-sm text-ink">מחפש/ת: {candidate.targetRoles.join(", ")}</p>
      )}

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {reasons.map((r) => (
            <li key={r.code} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              {r.labelHe}
            </li>
          ))}
        </ul>
      )}

      {candidate.shortIntro && (
        <p className="mt-3 text-sm italic text-ink/80">&quot;{candidate.shortIntro}&quot;</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
        <Tag label={connectionFormatLabels[candidate.connectionFormat]} />
        <Tag label={connectionCadenceLabels[candidate.connectionCadence]} />
        <Tag label={connectionModeLabels[candidate.connectionMode]} />
        {candidate.languages.map((l) => (
          <Tag key={l} label={l} />
        ))}
        {candidate.reasons.map((r) => (
          <Tag key={r} label={connectionReasonLabels[r]} />
        ))}
      </div>

      {candidate.availabilitySummary.length > 0 && (
        <p className="mt-3 text-xs text-muted">זמינות: {candidate.availabilitySummary.join(", ")}</p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!waitingOnOther && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => decide("INTERESTED")} disabled={pending} className="px-5 py-2 text-sm">
            רוצה להתחבר
          </Button>
          <Button variant="secondary" onClick={() => decide("NOT_NOW")} disabled={pending} className="px-5 py-2 text-sm">
            לא עכשיו
          </Button>
          <Button variant="secondary" onClick={() => decide("NOT_RELEVANT")} disabled={pending} className="px-5 py-2 text-sm">
            לא רלוונטי
          </Button>
          <button
            type="button"
            onClick={() => decide("NEVER_AGAIN")}
            disabled={pending}
            className="px-3 py-2 text-sm text-muted hover:text-red-600"
          >
            לא להציע שוב
          </button>
          <button
            type="button"
            onClick={() => setShowReport((v) => !v)}
            disabled={pending}
            className="px-3 py-2 text-sm text-muted hover:text-red-600"
          >
            דיווח
          </button>
        </div>
      )}

      {showReport && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-paper p-4">
          <select
            value={reportCategory}
            onChange={(e) => setReportCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            {Object.entries(reportCategoryLabels).map(([value, label]) => (
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

function Tag({ label }: { label?: string }) {
  if (!label) return null;
  return <span className={cn("rounded-full bg-paper px-2.5 py-1")}>{label}</span>;
}
