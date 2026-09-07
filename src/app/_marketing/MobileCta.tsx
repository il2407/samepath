"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { LinkButton } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";

/** Sticky bottom bar shown on small screens once the visitor scrolls past the hero. */
export function MobileCta() {
  const [visible, setVisible] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const nearBottom = latest + window.innerHeight > document.documentElement.scrollHeight - 320;
    setVisible(latest > 560 && !nearBottom);
  });

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-ink/12 bg-white/95 p-3 backdrop-blur transition-transform duration-300 sm:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-hidden={!visible}
    >
      <LinkButton href="/register" className="w-full" tabIndex={visible ? 0 : -1}>
        מצאו לי אנשים במסלול שלי
      </LinkButton>
    </div>
  );
}
