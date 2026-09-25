"use client";

import { cn } from "@/shared/ui/cn";

export interface ChipOption<T> {
  label: string;
  value: T;
}

export function SingleSelectChips<T>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((option, i) => {
        const active = value === option.value;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              active
                ? "border-primary bg-mint text-primary-dark"
                : "border-border bg-white text-ink hover:border-primary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
