"use client";
import { useEffect } from "react";

export function RememberListPosition({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const key = `list-position:${storageKey}`;
    let frame = 0;
    try {
      const value = Number(sessionStorage.getItem(key) ?? 0);
      frame = requestAnimationFrame(() =>
        window.scrollTo({ top: value, behavior: "instant" }),
      );
    } catch {
      /* Storage is optional in private browsing. */
    }
    const save = () => {
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        /* Optional. */
      }
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", save);
    };
  }, [storageKey]);
  return null;
}
