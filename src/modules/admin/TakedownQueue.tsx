"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resolveTakedownAction } from "@/modules/admin/takedown-actions";

export interface TakedownRow {
  id: string;
  requesterName: string;
  requesterEmail: string;
  reason: string;
  status: string;
  createdAt: Date;
  experienceId: string | null;
  companyName: string | null;
}

const statusLabels: Record<string, string> = {
  OPEN: "פתוחה",
  IN_REVIEW: "בבדיקה",
};

function TakedownCard({ row }: { row: TakedownRow }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve(status: "ACCEPTED" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      const result = await resolveTakedownAction({ takedownId: row.id, status, resolutionNote: note });
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-warm-surface px-2.5 py-1 text-xs text-ink">{statusLabels[row.status] ?? row.status}</span>
        <span className="text-xs text-muted">{row.createdAt.toLocaleDateString("he-IL")}</span>
      </div>
      <p className="mt-2 text-sm text-ink">
        {row.requesterName} · {row.requesterEmail}
        {row.companyName && <> · {row.companyName}</>}
      </p>
      <p className="mt-2 text-sm text-ink/80">{row.reason}</p>
      {!row.experienceId && <p className="mt-2 text-xs text-muted">לא מקושר לתוכן ספציפי בספרייה — אישור לא יסיר תוכן אוטומטית.</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הערת סגירה"
          className="min-w-40 flex-1 rounded-lg border border-border px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() => resolve("ACCEPTED")}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          אישור ההסרה
        </button>
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() => resolve("REJECTED")}
          className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-primary disabled:opacity-50"
        >
          דחיית הבקשה
        </button>
      </div>
    </div>
  );
}

export function TakedownQueue({ rows }: { rows: TakedownRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">אין בקשות הסרה פתוחות</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <TakedownCard key={r.id} row={r} />
      ))}
    </div>
  );
}
