"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { createGuideAction } from "@/modules/admin/guide-actions";

interface StepRow {
  key: string;
  title: string;
  prompt: string;
  kind: "AGENDA" | "PROMPT" | "FOLLOWUP";
  role: "PRESENTER" | "LISTENER" | "BOTH";
  durationMinutes: number | "";
}

export function CreateGuideForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [duration, setDuration] = useState(30);
  const [format, setFormat] = useState<"ONE_ON_ONE" | "GROUP" | "BOTH">("BOTH");
  const [category, setCategory] = useState("");
  const [publish, setPublish] = useState(true);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addStep() {
    setSteps((rows) => [
      ...rows,
      { key: crypto.randomUUID(), title: "", prompt: "", kind: "AGENDA", role: "BOTH", durationMinutes: "" },
    ]);
  }
  function updateStep(key: string, patch: Partial<StepRow>) {
    setSteps((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeStep(key: string) {
    setSteps((rows) => rows.filter((r) => r.key !== key));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!title.trim() || !purpose.trim()) return setError("נדרשים כותרת ומטרה");

    startTransition(async () => {
      const result = await createGuideAction({
        title: title.trim(),
        purpose: purpose.trim(),
        suggestedDurationMinutes: duration,
        format,
        category: category.trim() || undefined,
        publish,
        steps: steps
          .filter((s) => s.title.trim() && s.prompt.trim())
          .map((s) => ({
            title: s.title,
            prompt: s.prompt,
            kind: s.kind,
            role: s.role,
            durationMinutes: s.durationMinutes === "" ? undefined : s.durationMinutes,
          })),
      });
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setNotice("המדריך נוצר");
      setTitle("");
      setPurpose("");
      setSteps([]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <h2 className="font-semibold text-ink">יצירת מדריך</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="קטגוריה (לא חובה)" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} placeholder="משך מוצע (דקות)" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="rounded-xl border border-border px-3 py-2 text-sm">
          <option value="BOTH">אחד על אחד וגם קבוצה</option>
          <option value="ONE_ON_ONE">אחד על אחד</option>
          <option value="GROUP">קבוצה</option>
        </select>
      </div>
      <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="מטרת המדריך" rows={2} className="w-full rounded-xl border border-border px-3 py-2 text-sm" />

      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.key} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_2fr_auto_auto_auto_auto]">
            <input value={s.title} onChange={(e) => updateStep(s.key, { title: e.target.value })} placeholder="כותרת השלב" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
            <input value={s.prompt} onChange={(e) => updateStep(s.key, { prompt: e.target.value })} placeholder="שאלה מנחה / תוכן" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
            <select value={s.kind} onChange={(e) => updateStep(s.key, { kind: e.target.value as StepRow["kind"] })} className="rounded-lg border border-border px-2 py-1.5 text-sm">
              <option value="AGENDA">סדר יום</option>
              <option value="PROMPT">שאלה מנחה</option>
              <option value="FOLLOWUP">המשך</option>
            </select>
            <select value={s.role} onChange={(e) => updateStep(s.key, { role: e.target.value as StepRow["role"] })} className="rounded-lg border border-border px-2 py-1.5 text-sm">
              <option value="BOTH">תפקיד: שניכם</option>
              <option value="PRESENTER">תפקיד: פעיל/ה</option>
              <option value="LISTENER">תפקיד: מקשיב/ה</option>
            </select>
            <input
              type="number"
              min={0}
              value={s.durationMinutes}
              onChange={(e) => updateStep(s.key, { durationMinutes: e.target.value === "" ? "" : Number(e.target.value) })}
              placeholder="דקות"
              className="w-20 rounded-lg border border-border px-2 py-1.5 text-sm"
            />
            <button type="button" onClick={() => removeStep(s.key)} className="text-sm text-muted hover:text-danger">
              הסרה
            </button>
          </div>
        ))}
        <button type="button" onClick={addStep} className="text-sm font-medium text-primary hover:text-primary-dark">
          + הוספת שלב
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
        פרסום מיידי (אחרת יישמר כטיוטה)
      </label>

      {notice && <p className="text-sm text-primary-dark">{notice}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={pending} className="px-4 py-2 text-sm">
        {pending ? "יוצר…" : "יצירת מדריך"}
      </Button>
    </form>
  );
}
