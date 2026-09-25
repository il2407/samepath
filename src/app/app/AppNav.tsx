"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/ui/cn";
import styles from "./platform.module.css";

interface NavItem {
  href: string;
  label: string;
}

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/app", label: "ראשי" },
  { href: "/app/matches", label: "הצעות התאמה" },
  { href: "/app/connections", label: "החיבורים שלי" },
  { href: "/app/guides", label: "תוכן לתרגול" },
  { href: "/app/about", label: "מי אנחנו" },
  { href: "/app/contact", label: "צור קשר" },
];

const MOBILE_ITEMS = [
  { href: "/app", label: "ראשי", icon: "home" },
  { href: "/app/matches", label: "התאמות", icon: "matches" },
  { href: "/app/connections", label: "חיבורים", icon: "connections" },
  { href: "/app/guides", label: "תוכן לתרגול", icon: "guides" },
] as const;

const MORE_ITEMS: NavItem[] = [
  { href: "/app/about", label: "מי אנחנו" },
  { href: "/app/contact", label: "צור קשר" },
  { href: "/app/settings", label: "הגדרות" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  if (href === "/app/guides" && pathname.startsWith("/app/interviews")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname() ?? "/app";
  return <Navigation key={pathname} pathname={pathname} />;
}

function Navigation({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const firstLink = menuRef.current?.querySelector("a");
    (firstLink as HTMLAnchorElement | null)?.focus();

    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current?.contains(e.target as Node) || toggleRef.current?.contains(e.target as Node)) return;
      setMoreOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMoreOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <>
      <nav className={styles.navLinks} aria-label="ניווט ראשי">
        {PRIMARY_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={cn(styles.navLink, isActive(pathname, item.href) && styles.navLinkActive)}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.mobileNavigation}>
        <nav className={styles.bottomNav} aria-label="ניווט לנייד">
          {MOBILE_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(styles.bottomNavItem, isActive(pathname, item.href) && styles.bottomNavActive)}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={cn(styles.bottomNavItem, moreOpen && styles.bottomNavActive)}
          >
            <NavigationIcon name="more" />
            <span>עוד</span>
          </button>
        </nav>

        {moreOpen && (
          <nav ref={menuRef} aria-label="ניווט נוסף" className={styles.moreMenu}>
            {MORE_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={styles.moreMenuItem}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}

function NavigationIcon({ name }: { name: "home" | "matches" | "connections" | "guides" | "more" }) {
  const paths = {
    home: "m3 10 9-7 9 7v10H14v-6h-4v6H3Z",
    matches: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
    connections: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 2-6A8.5 8.5 0 1 1 21 11.5ZM7 11h.01M12 11h.01M17 11h.01",
    guides: "M12 5v15M12 5C8 3 5 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1Z",
    more: "M5 12h.01M12 12h.01M19 12h.01",
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
