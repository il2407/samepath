"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { createGroupAction } from "@/modules/admin/group-actions";

interface Option {
  id: string;
  labelHe: string;
}

export function CreateGroupForm({
  fields,
  targetRoles,
  guides,
}: {
  fields: Option[];
  targetRoles: Option[];
  guides: Option[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [professionalFieldId, setProfessionalFieldId] = useState("");
  const [targetRoleId, setTargetRoleId] = useState("");
  const [mode, setMode] = useState<"ONLINE" | "IN_PERSON">("ONLINE");
  const [schedule, setSchedule] = useState("");
  const [capacityMin, setCapacityMin] = useState(4);
  const [capacityMax, setCapacityMax] = useState(6);
  const [theme, setTheme] = useState("");
  const [guideId, setGuideId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!title.trim()) return setError("נדרש שם לקבוצה");

    startTransition(async () => {
      const result = await createGroupAction({
        title: title.trim(),
        professionalFieldId: professionalFieldId || undefined,
        targetRoleId: targetRoleId || undefined,
        mode,
        schedule: schedule.trim() || undefined,
        capacityMin,
        capacityMax,
        theme: theme.trim() || undefined,
        guideId: guideId || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setNotice("הקבוצה נוצרה");
      setTitle("");
      setSchedule("");
      setTheme("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <h2 className="font-semibold text-ink">יצירת קבוצה</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="שם הקבוצה"
          className="rounded-xl border border-border px-3 py-2 text-sm"
        />
        <select value={professionalFieldId} onChange={(e) => setProfessionalFieldId(e.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm">
          <option value="">תחום מקצועי (לא חובה)</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.labelHe}
            </option>
          ))}
        </select>
        <select value={targetRoleId} onChange={(e) => setTargetRoleId(e.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm">
          <option value="">תפקיד יעד (לא חובה)</option>
          {targetRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.labelHe}
            </option>
          ))}
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value as "ONLINE" | "IN_PERSON")} className="rounded-xl border border-border px-3 py-2 text-sm">
          <option value="ONLINE">מקוון</option>
          <option value="IN_PERSON">פרונטלי</option>
        </select>
        <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="לוח זמנים (טקסט חופשי)" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <input type="number" value={capacityMin} onChange={(e) => setCapacityMin(Number(e.target.value))} placeholder="קיבולת מינימלית" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <input type="number" value={capacityMax} onChange={(e) => setCapacityMax(Number(e.target.value))} placeholder="קיבולת מקסימלית" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="נושא (לא חובה)" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <select value={guideId} onChange={(e) => setGuideId(e.target.value)} className="rounded-xl border border-border px-3 py-2 text-sm">
          <option value="">מדריך מצורף (לא חובה)</option>
          {guides.map((g) => (
            <option key={g.id} value={g.id}>
              {g.labelHe}
            </option>
          ))}
        </select>
      </div>
      {notice && <p className="text-sm text-primary-dark">{notice}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={pending} className="px-4 py-2 text-sm">
        {pending ? "יוצר…" : "יצירת קבוצה"}
      </Button>
    </form>
  );
}
