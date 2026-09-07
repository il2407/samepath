"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { Container } from "@/shared/ui/Container";
import { LinkButton } from "@/shared/ui/Button";
import { Logo } from "@/shared/ui/Logo";
import { cn } from "@/shared/ui/cn";
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
        "sticky top-0 z-40 border-b bg-paper/95 backdrop-blur transition-colors",
        scrolled ? "border-ink/15" : "border-ink/0",
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="SamePath">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-ink">
            איך זה עובד
          </a>
          <a href="#privacy" className="transition-colors hover:text-ink">
            פרטיות
          </a>
          <a href="#pricing" className="transition-colors hover:text-ink">
            מחיר
          </a>
          <a href="#faq" className="transition-colors hover:text-ink">
            שאלות נפוצות
          </a>
          <Link href="/login" className="transition-colors hover:text-ink">
            כניסה
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-ink hover:text-primary md:hidden">
            כניסה
          </Link>
          <LinkButton href="/register" className="px-4 py-2.5 text-sm sm:px-5">
            <span className="sm:hidden">הצטרפות</span>
            <span className="hidden sm:inline">הצטרפות ל־SamePath</span>
          </LinkButton>
        </div>
      </Container>
    </motion.header>
  );
}
