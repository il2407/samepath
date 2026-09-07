"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { joinGroupAction, leaveGroupAction, reportGroupAction } from "@/modules/groups/actions";
import { reportCategoryLabels } from "@/modules/profiles/labels";
import type { GroupDetail } from "@/modules/groups/service";

export function GroupDetailPanel({ group }: { group: GroupDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState("OTHER");
  const [reportDescription, setReportDescription] = useState("");

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinGroupAction(group.id);
      if (!result.ok) setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  function handleLeave() {
    startTransition(async () => {
      await leaveGroupAction(group.id);
      router.refresh();
    });
  }

  function submitReport() {
    startTransition(async () => {
      await reportGroupAction({ groupId: group.id, category: reportCategory, description: reportDescription });
      setShowReport(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {group.myMembershipStatus === "NONE" && (
          <Button onClick={handleJoin} disabled={pending} className="px-4 py-2 text-sm">
            {group.status === "FULL" ? "הצטרפות לרשימת המתנה" : "בקשה להצטרפות"}
          </Button>
        )}
        {(group.myMembershipStatus === "ACTIVE" || group.myMembershipStatus === "WAITLISTED") && (
          <Button variant="secondary" onClick={handleLeave} disabled={pending} className="px-4 py-2 text-sm">
            עזיבת הקבוצה
          </Button>
        )}
        <button
          type="button"
          onClick={() => setShowReport((v) => !v)}
          disabled={pending}
          className="px-3 py-2 text-sm text-muted hover:text-danger"
        >
          דיווח על חשש
        </button>
      </div>

      {showReport && (
        <div className="space-y-3 rounded-xl border border-border bg-paper p-4">
          <select
            value={reportCategory}
            onChange={(e) => setReportCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            {Object.entries(reportCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            placeholder="פרטים"
            rows={2}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
          <Button onClick={submitReport} disabled={pending} className="px-4 py-2 text-sm">
            שליחת דיווח
          </Button>
        </div>
      )}
    </div>
  );
}
