"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/shared/ui/cn";
import styles from "../platform.module.css";

const allSteps = [
  { key: "profile", label: "פרופיל מקצועי" },
  { key: "privacy", label: "פרטיות" },
  { key: "preferences", label: "העדפות חיבור" },
  { key: "overview", label: "סקירה ואישור" },
] as const;

export function OnboardingSteps({ completedIndex }: { completedIndex: number }) {
  const pathname = usePathname();
  // The DB-derived step (completedIndex) always points *past* whichever step
  // was last completed, so it can't tell us which step a user is actively
  // viewing when they deliberately re-edit an earlier one via ?edit=true —
  // for that we need the real route, not the stored progress.
  const routeStep = pathname?.split("/").pop();
  const routeIndex = allSteps.findIndex((s) => s.key === routeStep);
  const activeIndex = routeIndex >= 0 ? routeIndex : completedIndex;

  // The review step only earns a place in the indicator once the user has
  // actually reached it — showing it as a permanent 4th step up front makes
  // the flow look longer than the three steps someone actually has to fill in.
  const overviewReached = activeIndex >= 3 || completedIndex >= 3;
  const steps = overviewReached ? allSteps : allSteps.slice(0, 3);

  return (
    <ol className={`mb-8 flex items-center gap-2 text-sm ${styles.onboardingSteps}`}>
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
              index === activeIndex
                ? "bg-mint text-primary-dark ring-2 ring-primary"
                : index < completedIndex
                  ? "bg-primary text-white"
                  : "bg-warm-surface text-muted",
            )}
          >
            {index + 1}
          </span>
          <span className={index === activeIndex ? "font-medium text-ink" : "text-muted"}>{step.label}</span>
          {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
