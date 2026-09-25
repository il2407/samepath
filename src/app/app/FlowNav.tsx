import Link from "next/link";

interface FlowStep {
  href: string;
  label: string;
}

interface FlowNavProps {
  prev?: FlowStep;
  next?: FlowStep;
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      {direction === "right" ? (
        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="m3 10 9-7 9 7v10H14v-6h-4v6H3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlowNav({ prev, next }: FlowNavProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      {prev ? (
        <Link
          href={prev.href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-warm-surface hover:text-ink"
        >
          <ArrowIcon direction="right" />
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-warm-surface hover:text-ink"
      >
        <HomeIcon />
        לעמוד הראשי
      </Link>
      {next ? (
        <Link
          href={next.href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-warm-surface hover:text-ink"
        >
          {next.label}
          <ArrowIcon direction="left" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
