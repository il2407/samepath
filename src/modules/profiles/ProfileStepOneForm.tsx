"use client";

import { useState, useTransition } from "react";
import { CompanyPicker, type CompanySelection } from "@/modules/companies/CompanyPicker";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { saveProfileStepOneAction } from "@/modules/profiles/actions";

interface Option {
  id: string;
  labelHe: string;
}

interface TargetRoleOption extends Option {
  professionalFieldId: string;
}

interface PreviousPosition {
  key: string;
  company: CompanySelection | null;
  title: string;
  startMonth: string;
  endMonth: string;
}

export interface ProfileStepOneInitialData {
  professionalFieldId: string;
  targetRoleIds: string[];
  currentRoleTitle: string;
  regionId: string | null;
  shortIntro: string;
  tagIds: string[];
  languageIds: string[];
  currentCompany: CompanySelection | null;
  currentStartMonth: string;
  previousPositions: PreviousPosition[];
}

export function ProfileStepOneForm({
  fields,
  targetRoles,
  regions,
  skills,
  domains,
  languages,
  initial,
}: {
  fields: Option[];
  targetRoles: TargetRoleOption[];
  regions: Option[];
  skills: Option[];
  domains: Option[];
  languages: Option[];
  initial?: ProfileStepOneInitialData;
}) {
  const [fieldId, setFieldId] = useState(initial?.professionalFieldId ?? fields[0]?.id ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(initial?.targetRoleIds ?? []);
  const [currentRoleTitle, setCurrentRoleTitle] = useState(initial?.currentRoleTitle ?? "");
  const [regionId, setRegionId] = useState<string>(initial?.regionId ?? "");
  const [shortIntro, setShortIntro] = useState(initial?.shortIntro ?? "");
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? []);
  const [languageIds, setLanguageIds] = useState<string[]>(initial?.languageIds ?? []);

  const [currentCompany, setCurrentCompany] = useState<CompanySelection | null>(initial?.currentCompany ?? null);
  const [currentStartMonth, setCurrentStartMonth] = useState(initial?.currentStartMonth ?? "");

  const [previousPositions, setPreviousPositions] = useState<PreviousPosition[]>(initial?.previousPositions ?? []);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleRoles = targetRoles.filter((r) => r.professionalFieldId === fieldId);

  function toggle(list: string[], id: string, setList: (v: string[]) => void) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function addPreviousPosition() {
    setPreviousPositions((rows) => [
      ...rows,
      { key: crypto.randomUUID(), company: null, title: "", startMonth: "", endMonth: "" },
    ]);
  }

  function updatePreviousPosition(key: string, patch: Partial<PreviousPosition>) {
    setPreviousPositions((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removePreviousPosition(key: string) {
    setPreviousPositions((rows) => rows.filter((r) => r.key !== key));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (roleIds.length === 0) return setError("יש לבחור לפחות תפקיד יעד אחד");
    if (!currentRoleTitle.trim()) return setError("יש להזין תפקיד נוכחי");
    if (languageIds.length === 0) return setError("יש לבחור לפחות שפה אחת");
    if (!currentCompany) return setError("יש לבחור את החברה הנוכחית שלך מהרשימה, או להוסיף אותה");
    if (!currentStartMonth) return setError("יש להזין תאריך התחלה בתפקיד הנוכחי");
    for (const p of previousPositions) {
      if (!p.company || !p.title.trim() || !p.startMonth || !p.endMonth) {
        return setError("יש להשלים את כל השדות בתפקידים קודמים, או להסיר שורה לא שלמה");
      }
    }

    const positions = [
      {
        companyId: currentCompany.id,
        companyRaw: currentCompany.canonicalName,
        title: currentRoleTitle.trim(),
        startDate: `${currentStartMonth}-01`,
        endDate: null,
        isCurrent: true,
      },
      ...previousPositions.map((p) => ({
        companyId: p.company!.id,
        companyRaw: p.company!.canonicalName,
        title: p.title.trim(),
        startDate: `${p.startMonth}-01`,
        endDate: `${p.endMonth}-01`,
        isCurrent: false,
      })),
    ];

    startTransition(async () => {
      const result = await saveProfileStepOneAction({
        professionalFieldId: fieldId,
        targetRoleIds: roleIds,
        currentRoleTitle: currentRoleTitle.trim(),
        regionId: regionId || null,
        shortIntro: shortIntro.trim(),
        tagIds,
        languageIds,
        positions,
      });
      if (result && !result.ok) setError(result.error ?? "משהו השתבש. נסו שוב");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">תחום ותפקיד</h2>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="field">
            תחום מקצועי
          </label>
          <select
            id="field"
            value={fieldId}
            onChange={(e) => {
              setFieldId(e.target.value);
              setRoleIds([]);
            }}
            className="w-full rounded-xl border border-border bg-white px-4 py-3"
          >
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.labelHe}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">תפקיד/י יעד (ניתן לבחור יותר מאחד)</p>
          <div className="flex flex-wrap gap-2">
            {visibleRoles.map((role) => (
              <ChipToggle
                key={role.id}
                label={role.labelHe}
                active={roleIds.includes(role.id)}
                onClick={() => toggle(roleIds, role.id, setRoleIds)}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="currentRoleTitle">
            תואר התפקיד הנוכחי שלך (לשימוש פנימי, לא מוצג לפני התאמה)
          </label>
          <input
            id="currentRoleTitle"
            value={currentRoleTitle}
            onChange={(e) => setCurrentRoleTitle(e.target.value)}
            placeholder="לדוגמה: מפתח/ת Backend בכיר/ה"
            className="w-full rounded-xl border border-border bg-white px-4 py-3"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">ניסיון תעסוקתי</h2>
        <p className="text-sm text-muted">
          משמש לחישוב טווח הניסיון שלכם. תקופות חופפות (למשל עבודה נוספת לצד משרה מלאה) לא ייספרו כפול.
        </p>
        <div className="rounded-2xl border border-border p-4">
          <p className="mb-3 text-sm font-medium text-ink">התפקיד הנוכחי</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompanyPicker value={currentCompany} onChange={setCurrentCompany} placeholder="שם החברה הנוכחית" />
            <input
              type="month"
              value={currentStartMonth}
              onChange={(e) => setCurrentStartMonth(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-4 py-3"
              aria-label="תאריך תחילת העבודה"
            />
          </div>
        </div>

        {previousPositions.map((p) => (
          <div key={p.key} className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">תפקיד קודם</p>
              <button
                type="button"
                onClick={() => removePreviousPosition(p.key)}
                className="text-sm text-muted hover:text-red-600"
              >
                הסרה
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CompanyPicker
                value={p.company}
                onChange={(c) => updatePreviousPosition(p.key, { company: c })}
                placeholder="שם החברה"
              />
              <input
                value={p.title}
                onChange={(e) => updatePreviousPosition(p.key, { title: e.target.value })}
                placeholder="תפקיד"
                className="w-full rounded-xl border border-border bg-white px-4 py-3"
              />
              <input
                type="month"
                value={p.startMonth}
                onChange={(e) => updatePreviousPosition(p.key, { startMonth: e.target.value })}
                className="w-full rounded-xl border border-border bg-white px-4 py-3"
                aria-label="תאריך התחלה"
              />
              <input
                type="month"
                value={p.endMonth}
                onChange={(e) => updatePreviousPosition(p.key, { endMonth: e.target.value })}
                className="w-full rounded-xl border border-border bg-white px-4 py-3"
                aria-label="תאריך סיום"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addPreviousPosition}
          className="text-sm font-medium text-primary hover:text-primary-dark"
        >
          + הוספת תפקיד קודם
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">כישורים ותחומים</h2>
        <TagPicker label="כישורים וטכנולוגיות" options={skills} selected={tagIds} onToggle={(id) => toggle(tagIds, id, setTagIds)} />
        <TagPicker label="תחומים ותעשיות" options={domains} selected={tagIds} onToggle={(id) => toggle(tagIds, id, setTagIds)} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">שפות ומיקום</h2>
        <TagPicker label="שפות" options={languages} selected={languageIds} onToggle={(id) => toggle(languageIds, id, setLanguageIds)} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="region">
            אזור מגורים כללי
          </label>
          <select
            id="region"
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-border bg-white px-4 py-3"
          >
            <option value="">לא צוין</option>
            {regions
              .filter((r) => r.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.labelHe}
                </option>
              ))}
          </select>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">היכרות קצרה ואנונימית</h2>
        <p className="text-sm text-muted">מוצג למועמדים לפני אישור הדדי — בלי לחשוף פרטים מזהים.</p>
        <textarea
          value={shortIntro}
          onChange={(e) => setShortIntro(e.target.value.slice(0, 400))}
          rows={3}
          placeholder='לדוגמה: "מפתח Backend עם ניסיון במערכות בזמן אמת, מחפש/ת לשוחח עם אנשים שנמצאים בתהליך חיפוש דומה."'
          className="w-full rounded-xl border border-border bg-white px-4 py-3"
        />
        <p className="text-left text-xs text-muted">{shortIntro.length}/400</p>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "שומר…" : "המשך להגדרות פרטיות"}
      </Button>
    </form>
  );
}

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function TagPicker({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <ChipToggle key={opt.id} label={opt.labelHe} active={selected.includes(opt.id)} onClick={() => onToggle(opt.id)} />
        ))}
      </div>
    </div>
  );
}
