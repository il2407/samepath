"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { completeConnectionPreferencesAction } from "@/modules/profiles/actions";
import { genderPreferenceLabels } from "@/modules/profiles/labels";

type Format = "ONE_ON_ONE" | "GROUP" | "BOTH";
type Cadence = "ONE_TIME" | "RECURRING" | "BOTH";
type Mode = "ONLINE" | "IN_PERSON" | "BOTH";
type GenderPreference = "MALE" | "FEMALE" | "BOTH";
type Reason =
  | "SHARE_JOB_SEARCH"
  | "ACCOUNTABILITY"
  | "PROFESSIONAL_DISCUSSION"
  | "LEARNING_TOGETHER"
  | "CODING_PRACTICE"
  | "SYSTEM_DESIGN"
  | "INTERVIEW_SIMULATION"
  | "PROJECT_PITCH"
  | "BEHAVIORAL_INTERVIEW"
  | "MENTAL_SUPPORT"
  | "OTHER";

const coreReasons: { value: Reason; label: string }[] = [
  { value: "SHARE_JOB_SEARCH", label: "לשתף בתהליך החיפוש" },
  { value: "ACCOUNTABILITY", label: "ליווי והתחייבות הדדית (accountability)" },
  { value: "PROFESSIONAL_DISCUSSION", label: "שיתוף תהליך וייעוץ" },
  { value: "LEARNING_TOGETHER", label: "ללמוד יחד" },
];

const optionalPracticeReasons: { value: Reason; label: string }[] = [
  { value: "INTERVIEW_SIMULATION", label: "ראיון שאלות טכניות מדומה" },
  { value: "BEHAVIORAL_INTERVIEW", label: "ראיון התנהגותי מדומה" },
  { value: "SYSTEM_DESIGN", label: "ראיון עיצוב מערכות מדומה" },
  { value: "CODING_PRACTICE", label: "תרגול קוד" },
  { value: "PROJECT_PITCH", label: "פיצ'ינג פרויקט והצגה עצמית" },
  { value: "MENTAL_SUPPORT", label: "תמיכה נפשית ורגשית" },
];

const dayLabels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const timeBlocks = [
  { key: "morning", label: "בוקר", startMinute: 480, endMinute: 720 },
  { key: "afternoon", label: "צהריים", startMinute: 720, endMinute: 1020 },
  { key: "evening", label: "ערב", startMinute: 1020, endMinute: 1320 },
] as const;

export function PreferencesStepForm({ languages }: { languages: { id: string; labelHe: string }[] }) {
  const [minYears, setMinYears] = useState(0);
  const [maxYears, setMaxYears] = useState(15);
  const [format, setFormat] = useState<Format>("BOTH");
  const [cadence, setCadence] = useState<Cadence>("BOTH");
  const [mode, setMode] = useState<Mode>("ONLINE");
  const [genderPreference, setGenderPreference] = useState<GenderPreference>("BOTH");
  const [languageId, setLanguageId] = useState<string>(languages[0]?.id ?? "");
  const [reasons, setReasons] = useState<Reason[]>(["SHARE_JOB_SEARCH"]);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleReason(value: Reason) {
    setReasons((list) => (list.includes(value) ? list.filter((r) => r !== value) : [...list, value]));
  }

  function toggleSlot(day: number, blockKey: string) {
    const id = `${day}-${blockKey}`;
    setSelectedSlots((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (minYears > maxYears) return setError("טווח הניסיון אינו תקין");

    const availability = Array.from(selectedSlots).map((id) => {
      const [dayStr, blockKey] = id.split("-");
      const block = timeBlocks.find((b) => b.key === blockKey)!;
      return { dayOfWeek: Number(dayStr), startMinute: block.startMinute, endMinute: block.endMinute };
    });

    startTransition(async () => {
      const result = await completeConnectionPreferencesAction({
        peerMinExperienceMonths: Math.round(minYears * 12),
        peerMaxExperienceMonths: Math.round(maxYears * 12),
        format,
        cadence,
        mode,
        genderPreference,
        languageId: languageId || null,
        timezone: "Asia/Jerusalem",
        reasons,
        availability,
      });
      if (result && !result.ok) setError(result.error ?? "משהו השתבש. נסו שוב");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <section className="space-y-3">
        <h2 className="font-semibold text-ink">טווח ניסיון של עמיתים מתאימים</h2>
        <div className="flex items-center gap-3">
          <NumberField label="משנה" value={minYears} onChange={setMinYears} />
          <span className="text-muted">עד</span>
          <NumberField label="שנה" value={maxYears} onChange={setMaxYears} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">סוג חיבור</h2>
        <RadioGroup
          value={format}
          onChange={setFormat}
          options={[
            { value: "ONE_ON_ONE", label: "אחד על אחד" },
            { value: "GROUP", label: "קבוצה קטנה" },
            { value: "BOTH", label: "שניהם" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">תדירות</h2>
        <RadioGroup
          value={cadence}
          onChange={setCadence}
          options={[
            { value: "ONE_TIME", label: "חד-פעמי" },
            { value: "RECURRING", label: "קבוע" },
            { value: "BOTH", label: "שניהם" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">אופן המפגש</h2>
        <RadioGroup
          value={mode}
          onChange={setMode}
          options={[
            { value: "ONLINE", label: "מקוון" },
            { value: "IN_PERSON", label: "פרונטלי" },
            { value: "BOTH", label: "שניהם" },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">מגדר עמיתים מתאימים</h2>
        <RadioGroup
          value={genderPreference}
          onChange={setGenderPreference}
          options={Object.entries(genderPreferenceLabels).map(([value, label]) => ({
            value: value as GenderPreference,
            label,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">שפת שיחה מועדפת</h2>
        <select
          value={languageId}
          onChange={(e) => setLanguageId(e.target.value)}
          className="w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
        >
          {languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.labelHe}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">זמינות שבועית כללית</h2>
        <p className="text-sm text-muted">רק כדי לאתר חפיפה כללית בזמינות — לא לתזמון מפגש ספציפי.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-right" />
                {timeBlocks.map((b) => (
                  <th key={b.key} className="p-2 text-center font-medium text-muted">
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayLabels.map((label, day) => (
                <tr key={day}>
                  <td className="p-2 font-medium text-ink">{label}</td>
                  {timeBlocks.map((b) => {
                    const id = `${day}-${b.key}`;
                    const active = selectedSlots.has(id);
                    return (
                      <td key={b.key} className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSlot(day, b.key)}
                          aria-pressed={active}
                          className={cn(
                            "size-9 rounded-lg border",
                            active ? "border-primary bg-mint" : "border-border bg-white hover:border-primary",
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">למה חשוב לכם להתחבר</h2>
        <div className="flex flex-wrap gap-2">
          {coreReasons.map((r) => (
            <ReasonChip key={r.value} label={r.label} active={reasons.includes(r.value)} onClick={() => toggleReason(r.value)} />
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">סוגי המפגש שמעניינים אותך</p>
          <div className="flex flex-wrap gap-2">
            {optionalPracticeReasons.map((r) => (
              <ReasonChip key={r.value} label={r.label} active={reasons.includes(r.value)} onClick={() => toggleReason(r.value)} />
            ))}
          </div>
        </div>
      </section>

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "מפעיל…" : "הפעלת הפרופיל"}
      </Button>
    </form>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="number"
        min={0}
        max={40}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded-xl border border-border bg-white px-3 py-2"
      />
      {label}
    </label>
  );
}

function RadioGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" checked={value === opt.value} onChange={() => onChange(opt.value)} />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function ReasonChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors",
        active ? "border-primary bg-mint text-primary-dark" : "border-border bg-white text-ink hover:border-primary",
      )}
    >
      {label}
    </button>
  );
}
