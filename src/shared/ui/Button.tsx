import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/shared/ui/cn";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-[15px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "border border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink hover:text-primary",
};

type Variant = keyof typeof variants;

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(base, variants[variant], className)} {...props} />;
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}
