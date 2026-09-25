"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/ui/cn";

const TABS = [
  { href: "/app/settings/profile", label: "פרופיל מקצועי" },
  { href: "/app/settings/privacy", label: "פרטיות" },
  { href: "/app/settings/account", label: "חשבון" },
];

export function SettingsTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="ניווט הגדרות" className="flex gap-3 overflow-x-auto border-b sm:gap-6 border-border">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 pb-3 text-sm transition-colors",
              active ? "border-primary font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
