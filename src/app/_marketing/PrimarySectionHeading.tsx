import type { ReactNode } from "react";
import { cn } from "@/shared/ui/cn";

const tones = {
  primary: { text: "text-primary", line: "bg-primary/30" },
  calm: { text: "text-calm", line: "bg-calm/35" },
  happy: { text: "text-happy-dark", line: "bg-happy/40" },
};

/** Kicker shown above a primary section's main message — small, mono-tracked, flanked by hairlines, always centered. */
export function PrimarySectionHeading({
  children,
  tone = "primary",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  const { text, line } = tones[tone];
  return (
    <p className={cn("flex items-center justify-center gap-3 text-center text-lg font-bold tracking-tight sm:text-xl", text, className)}>
      <span className={cn("h-px w-8 sm:w-12", line)} aria-hidden />
      {children}
      <span className={cn("h-px w-8 sm:w-12", line)} aria-hidden />
    </p>
  );
}

/** Quiet, smaller heading used to organize content inside a primary section. */
export function SubsectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-lg font-bold tracking-tight text-ink sm:text-xl", className)}>{children}</h3>;
}
