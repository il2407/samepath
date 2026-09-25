"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { Avatar } from "@/shared/ui/Avatar";
import { CvVerifiedBadge } from "@/shared/ui/CvVerifiedBadge";
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

type MatchTier = "high" | "medium" | "low";

function matchTier(percentage: number): MatchTier {
  if (percentage >= 85) return "high";
  if (percentage >= 70) return "medium";
  return "low";
}

/** All three tiers stay within the single brand-blue hue — only the tint's strength changes, so a higher match visually stands out without introducing a second color. */
const CARD_TIER_STYLES: Record<MatchTier, string> = {
  high: "border-primary/50 bg-primary/[0.04]",
  medium: "border-border bg-primary/[0.02]",
  low: "border-border bg-white",
};

const BADGE_TIER_STYLES: Record<MatchTier, string> = {
  high: "bg-primary text-white",
  medium: "bg-mint text-primary-dark",
  low: "bg-paper text-ink",
};

export function SuggestionCard({
  matchSuggestionId,
  candidate,
  codeName,
  matchPercentage,
  reasons,
  waitingOnOther,
}: {
  matchSuggestionId: string;
  candidate: PreMatchCandidateDTO;
  /** System-generated anonymous name shown until mutual approval — see SuggestionView.codeName. */
  codeName: string;
  matchPercentage: number;
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

  function decide(decision: "INTERESTED" | "NOT_NOW" | "NEVER_AGAIN") {
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

  const tier = matchTier(matchPercentage);

  return (
    <div className={cn("rounded-2xl border p-6", CARD_TIER_STYLES[tier])}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar seed={codeName} />
          <div>
            <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
              {codeName}
              {candidate.cvVerified && <CvVerifiedBadge />}
            </p>
            <p className="text-sm text-muted">
              {[
                candidate.company,
                candidate.professionalField,
                candidate.seniorityBand,
                candidate.yearsOfExperience != null ? `${candidate.yearsOfExperience} שנות ניסיון` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={cn("rounded-full px-3 py-1 text-xs font-semibold", BADGE_TIER_STYLES[tier])}
            title="רמת ההתאמה מחושבת מהעדפות, תפקיד יעד, תחום, ניסיון, זמינות וכישורים משותפים"
          >
            {matchPercentage}% התאמה
          </span>
          {waitingOnOther && (
            <span className="rounded-full bg-warm-surface px-3 py-1 text-xs font-medium text-muted">
              ממתין/ה לתשובת הצד השני
            </span>
          )}
        </div>
      </div>

      {candidate.targetRoles.length > 0 && (
        <p className="mt-3 text-sm text-ink">מחפש/ת: {candidate.targetRoles.join(", ")}</p>
      )}

      {reasons.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">למה זה מתאים</p>
          <ul className="mt-1 space-y-1 text-sm text-muted">
            {reasons.map((r) => (
              <li key={r.code} className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {r.labelHe}
                <span className="text-ink/60">— {r.percentage}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidate.shortIntro && (
        <p className="mt-3 text-sm italic text-ink/80">&quot;{candidate.shortIntro}&quot;</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
        <Tag label={connectionFormatLabels[candidate.connectionFormat]} />
        <Tag label={connectionCadenceLabels[candidate.connectionCadence]} />
        <Tag label={connectionModeLabels[candidate.connectionMode]} />
        {candidate.reasons.map((r) => (
          <Tag key={r} label={connectionReasonLabels[r]} />
        ))}
      </div>

      {candidate.availabilitySummary.length > 0 && (
        <p className="mt-3 text-xs text-muted">זמינות: {candidate.availabilitySummary.join(", ")}</p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {!waitingOnOther && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => decide("INTERESTED")} disabled={pending} className="px-5 py-2 text-sm">
            רוצה להתחבר
          </Button>
          <Button
            variant="secondary"
            onClick={() => decide("NOT_NOW")}
            disabled={pending}
            title="ההצעה תוסר מהרשימה — יכול להיות שתופיע שוב בעתיד"
            className="px-5 py-2 text-sm"
          >
            לא מתאים לי כרגע
          </Button>
          <button
            type="button"
            onClick={() => decide("NEVER_AGAIN")}
            disabled={pending}
            title="לעולם לא נציע לך את המשתמש/ת הזה/ה שוב"
            className="px-3 py-2 text-sm text-muted hover:text-danger"
          >
            לא להציע יותר את המשתמש/ת הזה/ה
          </button>
          <button
            type="button"
            onClick={() => setShowReport((v) => !v)}
            disabled={pending}
            className="px-3 py-2 text-sm text-muted hover:text-danger"
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
