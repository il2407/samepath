"use client";

import { motion, useReducedMotion } from "motion/react";

const profiles = [
  {
    label: "הפרופיל שלכם",
    role: "Software Engineer",
    experience: "3–5 שנות ניסיון",
    tags: ["React", "Node.js", "TypeScript", "PostgreSQL"],
    practicing: "ריאיון טכני ו־System Design",
    tilt: -3,
  },
  {
    role: "Software Engineer",
    experience: "4–6 שנות ניסיון",
    tags: ["React", "Node.js", "TypeScript", "SaaS"],
    practicing: "ריאיון טכני והצגת פרויקטים",
    tilt: 2.5,
  },
];

/** Decorative illustration: a pair of gently tilted, hoverable profile cards
 * "connected" by a floating match badge. Purely visual — screen readers get
 * one summary via the wrapping role="img" instead of walking each node. */
export function MatchIllustration() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="img"
      aria-label="המחשה של הצעת התאמה: הפרופיל שלכם לצד פרופיל אנונימי של מפתח Full Stack ברמת ניסיון דומה, המעוניין לתרגל תחומים דומים"
      className="relative mx-auto w-full max-w-md"
    >
      <div className="relative" aria-hidden>
        <motion.div
          className="group relative z-10"
          animate={{ rotate: reduceMotion ? 0 : profiles[0].tilt }}
          whileHover={reduceMotion ? undefined : { rotate: 0, scale: 1.03, y: -6 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <ProfileCard {...profiles[0]} />
        </motion.div>

        <div className="relative z-20 -my-4 flex justify-center">
          <span className="animate-float inline-flex items-center gap-1.5 rounded-sm border border-primary/20 bg-mint px-3 py-1.5 font-mono text-xs font-semibold text-primary-dark">
            <LinkIcon />
            87% התאמה
          </span>
        </div>

        <motion.div
          className="group relative z-0"
          animate={{ rotate: reduceMotion ? 0 : profiles[1].tilt }}
          whileHover={reduceMotion ? undefined : { rotate: 0, scale: 1.03, y: -6 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <ProfileCard {...profiles[1]} />
        </motion.div>
      </div>
    </div>
  );
}

function ProfileCard({
  label,
  role,
  experience,
  tags,
  practicing,
}: {
  label?: string;
  role: string;
  experience: string;
  tags: string[];
  practicing: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-sm border border-ink/15 bg-white p-5 shadow-[0_16px_40px_-28px_rgba(21,19,15,0.5)] transition-shadow duration-300 group-hover:shadow-[0_24px_48px_-24px_rgba(21,19,15,0.55)]">
      {label ? (
        <span className="mb-3 inline-flex items-center border-b border-primary pb-0.5 text-[11px] font-bold text-primary">
          {label}
        </span>
      ) : null}
      <div className="flex items-center gap-3">
        <AnonymousAvatar />
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{role}</p>
          <p className="text-sm text-muted">{experience}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-sm border border-primary/15 bg-mint/60 px-2.5 py-1 font-mono text-[11px] font-medium text-ink/80"
          >
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        <span className="font-medium text-ink/70">רוצה לתרגל: </span>
        {practicing}
      </p>
    </div>
  );
}

function AnonymousAvatar() {
  return (
    <div className="relative shrink-0">
      <div className="flex size-11 items-center justify-center rounded-sm bg-ink/5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-ink/40">
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
        </svg>
      </div>
      <span className="absolute -bottom-0.5 -end-0.5 flex size-3.5 items-center justify-center rounded-full bg-white">
        {/* Tailwind's animate-pulse isn't reduced-motion-aware by default (unlike
            the .animate-float keyframe in globals.css, which is scoped inside a
            prefers-reduced-motion media query) — motion-reduce:animate-none closes
            that gap for this continuously-looping decorative indicator. */}
        <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
      </span>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="6" cy="8" r="4.2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="8" r="4.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
