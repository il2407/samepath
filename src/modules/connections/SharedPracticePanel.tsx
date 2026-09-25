"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/Button";
import { changePracticeAction } from "./content-actions";
import {
  contentHref,
  type PracticeContent,
  type SharedPractice,
} from "./content";

export function PracticeSummary({ content }: { content: PracticeContent }) {
  return (
    <>
      <h3 className="mt-2 font-semibold text-ink">{content.title}</h3>
      <p className="mt-1 text-sm text-muted">{content.purpose}</p>
      {(content.minutes || content.level) && (
        <p className="mt-2 text-xs text-muted">
          {[content.minutes ? `כ-${content.minutes} דקות` : null, content.level]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </>
  );
}

export function SharedPracticePanel({
  connectionId,
  practice,
  userId,
  active,
}: {
  connectionId: string;
  practice?: SharedPractice;
  userId: string;
  active: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [active, router]);
  const catalog = `/app/guides?connection=${encodeURIComponent(connectionId)}`;
  function accept() {
    startTransition(async () => {
      try {
        const result = await changePracticeAction({
          connectionId,
          revision: practice?.revision ?? 0,
        });
        setError(result.error ?? "");
        router.refresh();
      } catch {
        setError("השמירה לא הצליחה. נסו שוב");
      }
    });
  }
  return (
    <section
      id="practice"
      aria-labelledby="practice-title"
      className="rounded-2xl border border-border bg-white p-6"
    >
      <h2 id="practice-title" className="text-lg font-semibold text-ink">
        מה נתרגל יחד?
      </h2>
      {practice?.agreed && (
        <div className="mt-4 rounded-xl bg-mint p-4">
          <p className="text-sm font-medium text-primary-dark">
            בחרתם לתרגל יחד
          </p>
          <PracticeSummary content={practice.agreed} />
          <Link
            href={contentHref(practice.agreed, connectionId)}
            className="mt-3 inline-flex min-h-11 items-center font-medium text-primary-dark underline"
          >
            {practice.agreed.key.startsWith("interview:")
              ? "פתיחת השאלות למפגש"
              : "פתיחת מערך המפגש"}
          </Link>
        </div>
      )}
      {practice?.pending ? (
        <div className="mt-4 rounded-xl border border-border bg-paper p-4">
          <p className="text-sm font-medium text-ink">
            {practice.proposedBy === userId
              ? "ממתינים לאישור התוכן מהצד השני"
              : "הוצע תוכן למפגש — מתאים לך?"}
          </p>
          <PracticeSummary content={practice.pending} />
          {practice.agreed && (
            <p className="mt-2 text-sm text-muted">
              הבחירה הקודמת נשארת בתוקף עד ששניכם תאשרו את ההחלפה.
            </p>
          )}
          <Link
            href={contentHref(practice.pending, connectionId)}
            className="mt-2 inline-flex min-h-11 items-center text-sm underline"
          >
            לעיון בתוכן המוצע
          </Link>
          {active && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {practice.proposedBy !== userId && (
                <Button onClick={accept} disabled={busy}>
                  {busy ? "שומרים…" : "מתאים לי"}
                </Button>
              )}
              <Link
                href={catalog}
                className="inline-flex min-h-11 items-center text-sm text-primary-dark underline"
              >
                הצעת חלופה
              </Link>
            </div>
          )}
        </div>
      ) : (
        active && (
          <div className="mt-3">
            {!practice?.agreed && (
              <p className="mb-3 text-sm text-muted">
                אפשר להתחיל בהיכרות קצרה, ואז לבחור מערך או קבוצת שאלות. ההצעה
                תמתין לאישור הצד השני.
              </p>
            )}
            <Link
              href={catalog}
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white"
            >
              {practice?.agreed ? "הצעת תוכן אחר" : "הציעו תוכן למפגש"}
            </Link>
          </div>
        )
      )}
      {!active && !practice?.pending && !practice?.agreed && (
        <p className="mt-3 text-sm text-muted">
          לא נבחר תוכן למפגש בחיבור הזה.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
