"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { joinGroupAction } from "@/modules/groups/actions";
import { connectionModeLabels } from "@/modules/profiles/labels";
import type { GroupSummary } from "@/modules/groups/service";

const membershipLabels: Record<GroupSummary["myMembershipStatus"], string> = {
  NONE: "",
  ACTIVE: "אתם חברים בקבוצה",
  WAITLISTED: "אתם ברשימת המתנה",
  LEFT: "",
};

const iconPalette = ["bg-mint text-primary-dark", "bg-sand text-calm-dark", "bg-happy/40 text-happy-dark"];

function paletteIndexFor(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return sum % iconPalette.length;
}

function GroupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="16" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="16" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function GroupCard({ group }: { group: GroupSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(group.myMembershipStatus);

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinGroupAction(group.id);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setLocalStatus(result.result === "WAITLISTED" ? "WAITLISTED" : "ACTIVE");
      router.refresh();
    });
  }

  const fillRatio = group.capacityMax > 0 ? Math.min(1, group.memberCount / group.capacityMax) : 0;

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconPalette[paletteIndexFor(group.id)]}`}
        >
          <GroupIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link href={`/app/groups/${group.id}`} className="font-semibold text-ink hover:text-primary">
                {group.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {[group.professionalField, group.targetRole, group.seniorityRange].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted">
              {group.memberCount}/{group.capacityMax}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-warm-surface">
            <div className="h-full rounded-full bg-primary" style={{ width: `${fillRatio * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        <Tag label={connectionModeLabels[group.mode]} />
        {group.location && <Tag label={group.location} />}
        {group.schedule && <Tag label={group.schedule} />}
        {group.theme && <Tag label={group.theme} />}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4">
        {localStatus === "NONE" ? (
          <Button onClick={handleJoin} disabled={pending} className="px-4 py-2 text-sm">
            {group.status === "FULL" ? "הצטרפות לרשימת המתנה" : "בקשה להצטרפות"}
          </Button>
        ) : (
          <span className="text-sm font-medium text-primary-dark">{membershipLabels[localStatus]}</span>
        )}
      </div>
    </div>
  );
}

function Tag({ label }: { label?: string }) {
  if (!label) return null;
  return <span className="rounded-full bg-paper px-2.5 py-1">{label}</span>;
}
