import { cn } from "@/shared/ui/cn";

/**
 * Trust signal shown alongside CvVerifiedBadge on a contact card: the person
 * has PUBLISHED at least one interview-experience write-up (real interview
 * questions, not a draft or one still in moderation) — see
 * InterviewExperience.status in schema.prisma and
 * ConnectionDetail.otherPartyPublishedInterviewCount. Every card that wants
 * this signal should import this component rather than re-styling its own,
 * same convention as CvVerifiedBadge.
 */
export function InterviewContributorBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-happy/40 bg-happy/15 px-2 py-0.5 text-[11px] font-medium text-happy-dark",
        className,
      )}
      title="שיתף/ה חוויות ראיון שפורסמו באתר"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3" aria-hidden>
        <path d="M4 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v3a1 1 0 0 0 1.6.8L10.667 14H16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4Z" />
      </svg>
      {count === 1 ? "שיתף/ה חוויית ראיון" : `שיתף/ה ${count} חוויות ראיון`}
    </span>
  );
}
