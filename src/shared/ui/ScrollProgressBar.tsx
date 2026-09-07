"use client";

import { motion, useScroll } from "motion/react";

/** Thin bar across the top of the viewport tracking scroll progress. Fills from the right (transform-origin: right) to match the page's RTL reading direction. */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-right bg-primary"
      style={{ scaleX: scrollYProgress }}
      aria-hidden
    />
  );
}
