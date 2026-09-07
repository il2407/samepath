import type { ReactNode } from "react";
import { cn } from "@/shared/ui/cn";

/** Small mono-numbered label used to open a section — hairline rule, index digit, Hebrew tag. */
export function SectionEyebrow({
  children,
  index,
  className,
}: {
  children: ReactNode;
  index?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-primary", className)}>
      {index ? <span className="font-mono text-xs font-medium tabular-nums">{index}</span> : null}
      <span className="h-px w-8 bg-primary/40" aria-hidden />
      <span className="text-sm font-semibold text-ink">{children}</span>
    </span>
  );
}
