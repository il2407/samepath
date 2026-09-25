"use client";

import { useState, type ReactNode } from "react";

export function MatchesTabs({ oneOnOne, groups }: { oneOnOne: ReactNode; groups: ReactNode }) {
  const [active, setActive] = useState<"ONE_ON_ONE" | "GROUPS">("ONE_ON_ONE");

  return (
    <div className="mt-6">
      <div role="tablist" className="flex gap-2 border-b border-border">
        <TabButton label="התאמות אישיות" isActive={active === "ONE_ON_ONE"} onClick={() => setActive("ONE_ON_ONE")} />
        <TabButton label="קבוצות למידה" isActive={active === "GROUPS"} onClick={() => setActive("GROUPS")} />
      </div>
      <div className="mt-4">{active === "ONE_ON_ONE" ? oneOnOne : groups}</div>
    </div>
  );
}

function TabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-focus ${
        isActive ? "border-primary text-primary-dark" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
