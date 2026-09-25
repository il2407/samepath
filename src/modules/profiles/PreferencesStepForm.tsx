"use client";

import Link from "next/link";
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
  | "INTRO_VIDEO_CALL"
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
  { key: "morning", label: "בוקר", hours: "08–12", selectAllLabel: "כל הבקרים", startMinute: 480, endMinute: 720 },
  { key: "afternoon", label: "צהריים", hours: "12–17", selectAllLabel: "כל הצהריים", startMinute: 720, endMinute: 1020 },
  { key: "evening", label: "ערב", hours: "17–22", selectAllLabel: "כל הערבים", startMinute: 1020, endMinute: 1320 },
] as const;

export interface PreferencesStepInitial {
  peerMinExperienceMonths: number;
  peerMaxExperienceMonths: number;
  format: Format;
  cadence: Cadence;
  mode: Mode;
  genderPreference: GenderPreference;
  reasons: Reason[];
  availability: { dayOfWeek: number; startMinute: number; endMinute: number }[];
}

interface ExperiencePreset {
  id: string;
  label: string;
  min: number;
  max: number;
}

/** Peer-experience-range presets, anchored to the user's own CV-derived years of experience where known. */
function buildExperiencePresets(ownYears: number | null): ExperiencePreset[] {
  if (ownYears != null) {
    return [
      { id: "similar", label: "ברמת ניסיון דומה לשלי", min: Math.max(0, ownYears - 3), max: ownYears + 5 },
      { id: "less", label: "פחות מנוסים ממני", min: 0, max: ownYears },
      { id: "more", label: "מנוסים יותר ממני", min: ownYears, max: 40 },
      { id: "any", label: "בכל רמת ניסיון", min: 0, max: 40 },
    ];
  }
  return [
    { id: "junior", label: "בתחילת הדרך", min: 0, max: 3 },
    { id: "mid", label: "עם כמה שנות ניסיון", min: 2, max: 8 },
    { id: "senior", label: "בכירים", min: 6, max: 40 },
    { id: "any", label: "בכל רמת ניסיון", min: 0, max: 40 },
  ];
}

export function PreferencesStepForm({
  initial,
  submitLabel,
  ownExperienceYears = null,
}: {
  /** When re-editing an already-completed preferences step (?edit=true), pre-fills the form from saved data. */
  initial?: PreferencesStepInitial;
  submitLabel?: string;
  /** Years of experience extracted from the user's own CV, used to pre-select a sensible peer-experience range. */
  ownExperienceYears?: number | null;
}) {
  const experiencePresets = buildExperiencePresets(ownExperienceYears);
  const defaultPreset = ownExperienceYears != null ? experiencePresets[0] : experiencePresets[experiencePresets.length - 1];

  const [minYears, setMinYears] = useState(initial ? initial.peerMinExperienceMonths / 12 : defaultPreset.min);
  const [maxYears, setMaxYears] = useState(initial ? initial.peerMaxExperienceMonths / 12 : defaultPreset.max);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    if (!initial) return defaultPreset.id;
    const match = experiencePresets.find(
      (p) => p.min === initial.peerMinExperienceMonths / 12 && p.max === initial.peerMaxExperienceMonths / 12,
    );
    return match?.id ?? null;
  });

  function applyPreset(preset: ExperiencePreset) {
    setSelectedPreset(preset.id);
    setMinYears(preset.min);
    setMaxYears(preset.max);
  }

  function nudgeMin(delta: number) {
    setSelectedPreset(null);
    setMinYears((v) => Math.max(0, Math.min(maxYears, v + delta)));
  }

  function nudgeMax(delta: number) {
    setSelectedPreset(null);
    setMaxYears((v) => Math.max(minYears, Math.min(40, v + delta)));
  }
  const [format, setFormat] = useState<Format>(initial?.format ?? "BOTH");
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? "BOTH");
  const [mode, setMode] = useState<Mode>(initial?.mode ?? "ONLINE");
  const [genderPreference, setGenderPreference] = useState<GenderPreference>(initial?.genderPreference ?? "BOTH");
  const [reasons, setReasons] = useState<Reason[]>(initial?.reasons ?? ["SHARE_JOB_SEARCH"]);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const slot of initial?.availability ?? []) {
      const block = timeBlocks.find((b) => b.startMinute === slot.startMinute && b.endMinute === slot.endMinute);
      if (block) set.add(`${slot.dayOfWeek}-${block.key}`);
    }
    return set;
  });

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

  function isColumnFullySelected(blockKey: string) {
    return dayLabels.every((_, day) => selectedSlots.has(`${day}-${blockKey}`));
  }

  function toggleColumn(blockKey: string) {
    const allSelected = isColumnFullySelected(blockKey);
    setSelectedSlots((set) => {
      const next = new Set(set);
      dayLabels.forEach((_, day) => {
        const id = `${day}-${blockKey}`;
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  const allSlotsSelected = selectedSlots.size === dayLabels.length * timeBlocks.length;

  function toggleAll() {
    setSelectedSlots(() => {
      if (allSlotsSelected) return new Set();
      return new Set(dayLabels.flatMap((_, day) => timeBlocks.map((b) => `${day}-${b.key}`)));
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
        timezone: "Asia/Jerusalem",
        reasons,
        availability,
      });
      if (result && !result.ok) setError(result.error ?? "משהו השתבש. נסו שוב");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <Link href="/app/onboarding/privacy?edit=true" className="inline-block text-sm text-primary hover:text-primary-dark">
        חזרה לעריכת הגדרות הפרטיות
      </Link>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">טווח ניסיון של עמיתים מתאימים</h2>
        {ownExperienceYears != null && (
          <p className="text-sm text-muted">זיהינו מקורות החיים שיש לכם כ-{ownExperienceYears} שנות ניסיון.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {experiencePresets.map((preset) => (
            <ReasonChip
              key={preset.id}
              label={preset.label}
              active={selectedPreset === preset.id}
              onClick={() => applyPreset(preset)}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm text-ink">
          <Stepper label="משנה" value={minYears} onDecrease={() => nudgeMin(-1)} onIncrease={() => nudgeMin(1)} />
          <span className="text-muted">עד</span>
          <Stepper label="שנה" value={maxYears} onDecrease={() => nudgeMax(-1)} onIncrease={() => nudgeMax(1)} />
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
        <h2 className="font-semibold text-ink">זמינות שבועית כללית</h2>
        <p className="text-sm text-muted">רק כדי לאתר חפיפה כללית בזמינות — לא לתזמון מפגש ספציפי.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="בחירה מהירה">
          {timeBlocks.map((b) => (
            <QuickSelectChip
              key={b.key}
              label={b.selectAllLabel}
              active={isColumnFullySelected(b.key)}
              onClick={() => toggleColumn(b.key)}
            />
          ))}
          <QuickSelectChip label="סמן הכל" active={allSlotsSelected} onClick={toggleAll} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-right" />
                {timeBlocks.map((b) => (
                  <th key={b.key} className="p-2 text-center font-medium text-ink">
                    <span className="block">{b.label}</span>
                    <span className="block text-xs font-normal text-muted" dir="ltr">
                      {b.hours}
                    </span>
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
                          aria-label={`${label}, ${b.label}`}
                          className={cn(
                            "inline-flex size-11 items-center justify-center rounded-lg border transition-colors",
                            active ? "border-primary bg-primary text-white" : "border-border bg-white hover:border-primary",
                          )}
                        >
                          {active && <CheckIcon />}
                        </button>
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
        {pending ? "שומר…" : (submitLabel ?? "המשך לסקירה")}
      </Button>
    </form>
  );
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrease}
        aria-label={`הפחתת ${label}`}
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-white text-ink hover:border-primary"
      >
        −
      </button>
      <span className="w-16 text-center">
        {value} {label}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={`הוספת ${label}`}
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-white text-ink hover:border-primary"
      >
        +
      </button>
    </div>
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

/** A quick-select toggle for a whole column (or the whole grid) — reads as selected only once every cell it covers is. */
function QuickSelectChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-white hover:bg-primary-dark" : "border-border bg-white text-ink hover:border-primary",
      )}
    >
      {active && <CheckIcon />}
      {label}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
