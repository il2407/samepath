import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/shared/ui/cn";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-white text-ink border border-border hover:border-primary hover:text-primary",
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
