"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { Container } from "@/shared/ui/Container";
import { LinkButton } from "@/shared/ui/Button";
import { Logo } from "@/shared/ui/Logo";
import { cn } from "@/shared/ui/cn";
import { PRICING_ENABLED } from "@/shared/features";
import { useState } from "react";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 8);
  });

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-40 border-b bg-paper/90 backdrop-blur-xl transition-[border-color,box-shadow] duration-300",
        scrolled
          ? "border-ink/10 shadow-[0_8px_30px_-24px_rgba(23,33,29,0.42)]"
          : "border-transparent",
      )}
    >
      <Container className="flex h-[4.5rem] items-center justify-between">
        <Link href="/" aria-label="SamePath">
          <Logo className="transition-opacity hover:opacity-75" wordmarkClassName="font-medium" />
        </Link>
        <nav
          className="hidden items-center gap-8 text-sm font-medium text-muted md:flex"
          aria-label="ניווט ראשי"
        >
          <a
            href="#privacy"
            className="relative py-2 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-right after:scale-x-0 after:bg-primary after:transition-transform hover:text-ink hover:after:scale-x-100"
          >
            פרטיות
          </a>
          <a
            href="#how-it-works"
            className="relative py-2 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-right after:scale-x-0 after:bg-primary after:transition-transform hover:text-ink hover:after:scale-x-100"
          >
            איך זה עובד
          </a>
          {PRICING_ENABLED && (
            <a
              href="#pricing"
              className="relative py-2 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-right after:scale-x-0 after:bg-primary after:transition-transform hover:text-ink hover:after:scale-x-100"
            >
              מחיר
            </a>
          )}
          <a
            href="#faq"
            className="relative py-2 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-right after:scale-x-0 after:bg-primary after:transition-transform hover:text-ink hover:after:scale-x-100"
          >
            שאלות נפוצות
          </a>
          <Link href="/login" className="transition-colors hover:text-ink">
            כניסה
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-ink hover:text-primary md:hidden"
          >
            כניסה
          </Link>
          <LinkButton
            href="/register"
            className="rounded-full px-4 py-2.5 text-sm shadow-[0_8px_24px_-14px_rgba(35,92,71,0.9)] sm:px-5"
          >
            <span className="sm:hidden">הצטרפות</span>
            <span className="hidden sm:inline">הצטרפות ל־SamePath</span>
          </LinkButton>
        </div>
      </Container>
    </motion.header>
  );
}
