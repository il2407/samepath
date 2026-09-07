"use client";

import { motion } from "motion/react";
import { useSyncExternalStore, type ReactNode } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  // Some environments (and, as a defensive baseline, older/minimal browsers)
  // have no matchMedia at all — degrade to "no preference" rather than throw.
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getClientSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// The server has no window to check, so it always renders as if there's no
// preference — the client's very first (pre-hydration) snapshot has to make
// the same assumption, or React's hydration diff fails for anyone with the
// OS reduced-motion setting on. This was confirmed live: motion/react's own
// useReducedMotion() reads matchMedia synchronously during the client's
// first render, which disagreed with the server-rendered `initial` style
// and produced a real "tree hydrated but some attributes ... didn't match"
// error. useSyncExternalStore (rather than a useEffect+setState "mounted"
// gate, which react-hooks/set-state-in-effect correctly flags as a
// cascading-render anti-pattern) is the React-blessed way to read this kind
// of client-only, externally-changing value while keeping the first render
// SSR-safe.
function getServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

/** Fades + slides content in once it scrolls into view. Reused across every marketing section — pass an increasing `delay` per item in a `.map()` to stagger a grid or list. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? undefined : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
