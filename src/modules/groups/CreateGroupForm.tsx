"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { createUserGroupAction } from "@/modules/groups/actions";

export function CreateGroupForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"ONLINE" | "IN_PERSON">("ONLINE");
  const [location, setLocation] = useState("");
  const [schedule, setSchedule] = useState("");
  const [theme, setTheme] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!theme.trim()) return setError("נא לפרט נושא ללמידה");

    startTransition(async () => {
      const result = await createUserGroupAction({
        mode,
        location: location.trim() || undefined,
        schedule: schedule.trim() || undefined,
        theme: theme.trim(),
      });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setNotice("הקבוצה נפתחה");
      setLocation("");
      setSchedule("");
      setTheme("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-dashed border-border p-5">
      <h3 className="font-semibold text-ink">פתיחת קבוצת למידה</h3>
      <p className="text-sm text-muted">כל אחד יכול לפתוח קבוצה — הגדירו מקום, זמן ונושא, וכל מי שלא חסום יוכל להצטרף.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "ONLINE" | "IN_PERSON")}
          className="rounded-xl border border-border px-3 py-2 text-sm"
        >
          <option value="ONLINE">מקוון</option>
          <option value="IN_PERSON">פרונטלי</option>
        </select>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="מקום (לא חובה)"
          className="rounded-xl border border-border px-3 py-2 text-sm"
        />
        <input
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="מועד (לא חובה)"
          className="rounded-xl border border-border px-3 py-2 text-sm"
        />
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="נושא ללמידה"
          className="rounded-xl border border-border px-3 py-2 text-sm"
        />
      </div>
      {notice && <p className="text-sm text-primary-dark">{notice}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={pending} className="px-4 py-2 text-sm">
        {pending ? "פותח…" : "פתיחת קבוצה"}
      </Button>
    </form>
  );
}
