import { cn } from "@/shared/ui/cn";

/**
 * The one place this trust signal is rendered — every candidate/connection
 * card must import this instead of re-styling its own badge, so the "gold
 * accent used sparingly" rule (see globals.css) stays enforced by a single
 * component rather than by convention across call sites.
 */
export function CvVerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-happy/40 bg-happy/15 px-2 py-0.5 text-[11px] font-medium text-happy-dark",
        className,
      )}
      title="המשתמש/ת אימת/ה את פרטי הפרופיל מול קורות חיים שהעלה/תה"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 0 1 0 1.415l-7.007 7.007a1 1 0 0 1-1.414 0L4.296 9.723a1 1 0 1 1 1.414-1.414l3.283 3.283 6.3-6.3a1 1 0 0 1 1.411-.002Z"
          clipRule="evenodd"
        />
      </svg>
      קו״ח מאומתים
    </span>
  );
}
