import Image from "next/image";
import { cn } from "@/shared/ui/cn";

type LogoMarkProps = {
  variant?: "color" | "mono";
  className?: string;
};

/** The SamePath mark. Use `variant="mono"` on dark backgrounds. */
export function LogoMark({ variant = "color", className }: LogoMarkProps) {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={512}
      height={512}
      className={cn("h-11 w-11", variant === "mono" && "brightness-0 invert", className)}
      aria-hidden="true"
      priority
    />
  );
}

type LogoProps = LogoMarkProps & {
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/** Full lockup: mark + "SamePath" wordmark. Use `variant="mono"` on dark backgrounds. */
export function Logo({ variant = "color", className, withWordmark = true, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark variant={variant} />
      {withWordmark && (
        <span
          className={cn(
            "text-xl font-black tracking-tight",
            variant === "mono" ? "text-white" : "text-ink",
            wordmarkClassName,
          )}
        >
          SamePath
        </span>
      )}
    </span>
  );
}
