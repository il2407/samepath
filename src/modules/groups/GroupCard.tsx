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

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
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

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        {group.language && <Tag label={group.language} />}
        <Tag label={connectionModeLabels[group.mode]} />
        {group.schedule && <Tag label={group.schedule} />}
        {group.theme && <Tag label={group.theme} />}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

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
