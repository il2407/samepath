"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./platform.module.css";

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const firstLink = menuRef.current?.querySelector("a");
    (firstLink as HTMLAnchorElement | null)?.focus();

    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current?.contains(e.target as Node) || toggleRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.userMenu}>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={styles.userMenuToggle}
        dir="ltr"
      >
        {email}
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label="תפריט משתמש" className={styles.userMenuDropdown}>
          <Link href="/app/settings" role="menuitem" className={styles.userMenuItem} onClick={() => setOpen(false)}>
            הגדרות חשבון
          </Link>
        </div>
      )}
    </div>
  );
}
