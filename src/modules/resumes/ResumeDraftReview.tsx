"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { CompanyPicker } from "@/modules/companies/CompanyPicker";
import { ChipToggle, TagPicker, type ProfileStepOneInitialData } from "@/modules/profiles/ProfileStepOneForm";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { genderLabels } from "@/modules/profiles/labels";
import { confirmResumeDraftAction, discardResumeDraftAction } from "@/modules/resumes/actions";
import { estimateExperienceYears } from "@/modules/resumes/ExtractedResumeSummary";
import type { StoredExtractedResumeData } from "@/modules/resumes/dto";

type Gender = "MALE" | "FEMALE";
type PreviousPosition = ProfileStepOneInitialData["previousPositions"][number];

interface Option {
  id: string;
  labelHe: string;
}

interface TargetRoleOption extends Option {
  professionalFieldId: string;
}

/**
 * Which single field's edit dialog is open. Previous positions are edited
 * one company at a time (`previous:<key>`), or `previous:new` to add one.
 */
type FieldKey =
  | "company"
  | "title"
  | "startMonth"
  | "targetRoles"
  | "summary"
  | "skills"
  | "region"
  | "linkedin"
  | "gender"
  | `previous:${string}`;

const fieldTitles: Record<string, string> = {
  company: "מקום עבודה נוכחי",
  title: "תפקיד נוכחי",
  startMonth: "תאריך תחילת העבודה",
  targetRoles: "תפקיד/י יעד",
  summary: "סיכום AI",
  skills: "כישורים ותחומים",
  region: "אזור מגורים",
  linkedin: "פרופיל LinkedIn",
  gender: "מגדר",
};

/** The first required field that's still empty, in card order — approving
 * with one missing opens that field's dialog instead of a generic error. */
function firstMissingField(v: ProfileStepOneInitialData): FieldKey | null {
  if (!v.currentCompany) return "company";
  if (!v.currentRoleTitle.trim()) return "title";
  if (!v.currentStartMonth) return "startMonth";
  if (v.targetRoleIds.length === 0) return "targetRoles";
  if (!v.linkedInUrl.trim()) return "linkedin";
  return null;
}

function isCompletePosition(p: PreviousPosition): boolean {
  return !!p.company && !!p.title.trim() && !!p.startMonth && !!p.endMonth;
}

/** Incomplete previous-position rows are supplementary, not required, so
 * approving skips them rather than blocking on them. */
function buildPositions(v: ProfileStepOneInitialData) {
  return [
    {
      companyId: v.currentCompany!.id,
      companyRaw: v.currentCompany!.canonicalName,
      title: v.currentRoleTitle.trim(),
      startDate: `${v.currentStartMonth}-01`,
      endDate: null as string | null,
      isCurrent: true,
    },
    ...v.previousPositions.filter(isCompletePosition).map((p) => ({
      companyId: p.company!.id,
      companyRaw: p.company!.canonicalName,
      title: p.title.trim(),
      startDate: `${p.startMonth}-01`,
      endDate: `${p.endMonth}-01`,
      isCurrent: false,
    })),
  ];
}

/**
 * Review card for an AI/heuristic resume extraction. Every extracted value
 * is a row that opens its own small edit dialog — the full manual-entry form
 * (ProfileStepOneForm) is deliberately not shown here; it's only for users
 * who discard the draft and fill the profile in by hand.
 */
export function ResumeDraftReview({
  uploadId,
  originalFilename,
  initial,
  extracted,
  fields,
  targetRoles,
  regions,
  skills,
  domains,
}: {
  uploadId: string;
  originalFilename: string;
  initial: ProfileStepOneInitialData;
  extracted: StoredExtractedResumeData;
  fields: Option[];
  targetRoles: TargetRoleOption[];
  regions: Option[];
  skills: Option[];
  domains: Option[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileStepOneInitialData>(() => ({
    ...initial,
    gender: initial.gender ?? "MALE",
    // The card shows the AI-composed intro up front (item: "show the AI
    // summary on the first card"); it's still the user's to edit or clear
    // before approving, and it's labelled as shown pre-match.
    shortIntro: initial.shortIntro || extracted.aiSummaryGuess || "",
  }));
  const [openField, setOpenField] = useState<FieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const experienceYears = estimateExperienceYears(extracted.positions);
  const labelOf = (list: Option[], id: string | null) => list.find((o) => o.id === id)?.labelHe ?? "";
  const roleLabels = values.targetRoleIds.map((id) => labelOf(targetRoles, id)).filter(Boolean);
  const tagLabels = values.tagIds.map((id) => labelOf(skills, id) || labelOf(domains, id)).filter(Boolean);

  function approve() {
    setError(null);
    const missing = firstMissingField(values);
    if (missing) {
      setError(`חסר: ${fieldTitles[missing]} — יש להשלים לפני האישור`);
      setOpenField(missing);
      return;
    }
    startTransition(async () => {
      const result = await confirmResumeDraftAction({
        uploadId,
        profile: {
          professionalFieldId: values.professionalFieldId,
          targetRoleIds: values.targetRoleIds,
          currentRoleTitle: values.currentRoleTitle.trim(),
          regionId: values.regionId || null,
          shortIntro: values.shortIntro.trim(),
          tagIds: values.tagIds,
          positions: buildPositions(values),
          gender: values.gender,
          linkedInUrl: values.linkedInUrl.trim(),
        },
      });
      if (result && !result.ok) setError(result.error ?? "משהו השתבש. נסו שוב");
    });
  }

  function discard() {
    setError(null);
    startTransition(async () => {
      const result = await discardResumeDraftAction(uploadId);
      if (!result.ok) return setError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  function save(patch: Partial<ProfileStepOneInitialData>) {
    setValues((v) => ({ ...v, ...patch }));
    setOpenField(null);
    setError(null);
  }

  const editingPositionKey = openField?.startsWith("previous:") ? openField.slice("previous:".length) : null;

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">טיוטה מתוך {originalFilename}</h2>
        <button type="button" disabled={pending} onClick={discard} className="text-sm text-muted hover:text-danger">
          מחיקת הטיוטה והתחלה ידנית
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">זה מה שמצאנו בקובץ. לחיצה על כל פרט פותחת עריכה שלו בלבד.</p>

      <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-paper text-sm">
        <FieldRow label={fieldTitles.company} value={values.currentCompany?.canonicalName} onEdit={() => setOpenField("company")} required />
        <FieldRow label={fieldTitles.title} value={values.currentRoleTitle} onEdit={() => setOpenField("title")} required />
        <FieldRow label={fieldTitles.startMonth} value={values.currentStartMonth} onEdit={() => setOpenField("startMonth")} required />
        <FieldRow label={fieldTitles.targetRoles} value={roleLabels.join(" · ")} onEdit={() => setOpenField("targetRoles")} required />
        <FieldRow
          label={fieldTitles.summary}
          hint="מוצג למועמדים לפני אישור הדדי"
          value={values.shortIntro}
          onEdit={() => setOpenField("summary")}
          multiline
        />
        <FieldRow label={fieldTitles.linkedin} value={values.linkedInUrl} onEdit={() => setOpenField("linkedin")} required />
        <FieldRow label={fieldTitles.skills} value={tagLabels.join(" · ")} onEdit={() => setOpenField("skills")} multiline />
        <FieldRow label={fieldTitles.region} value={labelOf(regions, values.regionId)} onEdit={() => setOpenField("region")} />
        <FieldRow
          label={fieldTitles.gender}
          hint="לצורך התאמה בלבד, לא מוצג לפני אישור הדדי"
          value={values.gender ? genderLabels[values.gender] : ""}
          onEdit={() => setOpenField("gender")}
        />
        {experienceYears !== null && (
          <div className="flex flex-wrap justify-between gap-2 px-4 py-3">
            <dt className="text-muted">שנות ניסיון (מחושב)</dt>
            <dd className="font-medium text-ink">כ-{experienceYears} שנים</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 rounded-xl border border-border bg-paper p-4 text-sm">
        <p className="mb-2 font-medium text-ink">מקומות עבודה קודמים</p>
        {values.previousPositions.length === 0 && <p className="text-muted">לא נמצאו.</p>}
        <ul className="space-y-1">
          {values.previousPositions.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => setOpenField(`previous:${p.key}`)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-white"
              >
                <span className="text-ink">
                  {p.company?.canonicalName ?? "—"}
                  {p.title && <span className="text-muted"> · {p.title}</span>}
                </span>
                <span className="text-muted">
                  {isCompletePosition(p) ? `${p.startMonth} – ${p.endMonth}` : <span className="text-danger">חסרים פרטים</span>}
                  <span className="ms-2 text-primary">עריכה</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpenField("previous:new")}
          className="mt-2 text-sm font-medium text-primary hover:text-primary-dark"
        >
          + הוספת מקום עבודה קודם
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">{error}</p>}

      <Button type="button" onClick={approve} disabled={pending} className="mt-4 w-full sm:w-auto">
        {pending ? "שומר…" : "אישור והמשך"}
      </Button>

      {openField === "company" && (
        <CompanyDialog value={values} onClose={() => setOpenField(null)} onSave={save} />
      )}
      {openField === "title" && (
        <TitleDialog value={values} extracted={extracted} onClose={() => setOpenField(null)} onSave={save} />
      )}
      {openField === "startMonth" && (
        <TextDialog
          title={fieldTitles.startMonth}
          type="month"
          initialValue={values.currentStartMonth}
          onClose={() => setOpenField(null)}
          onSave={(v) => save({ currentStartMonth: v })}
        />
      )}
      {openField === "targetRoles" && (
        <TargetRolesDialog value={values} fields={fields} targetRoles={targetRoles} onClose={() => setOpenField(null)} onSave={save} />
      )}
      {openField === "summary" && (
        <SummaryDialog value={values} extracted={extracted} onClose={() => setOpenField(null)} onSave={save} />
      )}
      {openField === "linkedin" && (
        <TextDialog
          title={fieldTitles.linkedin}
          hint="נחשף לצד השני רק לאחר חיבור פעיל."
          type="url"
          placeholder="https://www.linkedin.com/in/your-name"
          initialValue={values.linkedInUrl}
          onClose={() => setOpenField(null)}
          onSave={(v) => save({ linkedInUrl: v.trim() })}
        />
      )}
      {openField === "skills" && (
        <SkillsDialog value={values} skills={skills} domains={domains} onClose={() => setOpenField(null)} onSave={save} />
      )}
      {openField === "region" && (
        <RegionDialog value={values} regions={regions} onClose={() => setOpenField(null)} onSave={save} />
      )}
      {openField === "gender" && <GenderDialog value={values} onClose={() => setOpenField(null)} onSave={save} />}
      {editingPositionKey !== null && (
        <PreviousPositionDialog
          position={values.previousPositions.find((p) => p.key === editingPositionKey) ?? null}
          onClose={() => setOpenField(null)}
          onSave={(position) =>
            save({
              previousPositions: values.previousPositions.some((p) => p.key === position.key)
                ? values.previousPositions.map((p) => (p.key === position.key ? position : p))
                : [...values.previousPositions, position],
            })
          }
          onRemove={(key) => save({ previousPositions: values.previousPositions.filter((p) => p.key !== key) })}
        />
      )}
    </div>
  );
}

function FieldRow({
  label,
  hint,
  value,
  onEdit,
  required = false,
  multiline = false,
}: {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onEdit: () => void;
  required?: boolean;
  multiline?: boolean;
}) {
  const empty = !value?.trim();
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`${label}: ${empty ? "לא זוהה" : value} — עריכה`}
      className={cn(
        "flex w-full gap-3 px-4 py-3 text-start transition-colors hover:bg-white",
        multiline ? "flex-col" : "flex-wrap items-center justify-between",
      )}
    >
      <span>
        <span className="block text-muted">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className="flex items-center gap-2">
        {empty ? (
          <span className={required ? "font-medium text-danger" : "text-muted"}>
            {required ? "לא זוהה — לחצו להשלמה" : "לא זוהה"}
          </span>
        ) : (
          <span className="font-medium text-ink">{value}</span>
        )}
        <span className="shrink-0 text-xs font-medium text-primary">עריכה</span>
      </span>
    </button>
  );
}

/** Minimal modal: overlay click and Escape both cancel; nothing is applied
 * to the card until "שמירה". */
function EditDialog({
  title,
  onClose,
  onSave,
  children,
  extraAction,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
  extraAction?: React.ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <h2 id={titleId} className="text-lg font-bold text-ink">
          {title}
        </h2>
        <div className="mt-4 space-y-3">{children}</div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit">שמירה</Button>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            ביטול
          </button>
          {extraAction && <span className="ms-auto">{extraAction}</span>}
        </div>
      </form>
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-border bg-white px-4 py-3";

type DialogProps = {
  value: ProfileStepOneInitialData;
  onClose: () => void;
  onSave: (patch: Partial<ProfileStepOneInitialData>) => void;
};

function TextDialog({
  title,
  hint,
  type = "text",
  placeholder,
  initialValue,
  onClose,
  onSave,
}: {
  title: string;
  hint?: string;
  type?: "text" | "month" | "url";
  placeholder?: string;
  initialValue: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [text, setText] = useState(initialValue);
  return (
    <EditDialog title={title} onClose={onClose} onSave={() => onSave(text)}>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <input
        autoFocus
        type={type}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={title}
        className={inputClass}
      />
    </EditDialog>
  );
}

function CompanyDialog({ value, onClose, onSave }: DialogProps) {
  const [company, setCompany] = useState(value.currentCompany);
  return (
    <EditDialog title={fieldTitles.company} onClose={onClose} onSave={() => onSave({ currentCompany: company })}>
      <CompanyPicker value={company} onChange={setCompany} placeholder="שם החברה הנוכחית" />
    </EditDialog>
  );
}

function TitleDialog({ value, extracted, onClose, onSave }: DialogProps & { extracted: StoredExtractedResumeData }) {
  const [title, setTitle] = useState(value.currentRoleTitle);
  // Every title the extraction saw for the current role — the AI's guess and
  // the parsed position title can disagree; offer both as one-tap options.
  const candidates = [
    ...new Set(
      [extracted.currentRoleTitleGuess, extracted.positions.find((p) => p.isCurrent)?.title, value.currentRoleTitle].filter(
        (t): t is string => !!t && t.trim() !== "",
      ),
    ),
  ];
  return (
    <EditDialog title={fieldTitles.title} onClose={onClose} onSave={() => onSave({ currentRoleTitle: title.trim() })}>
      <p className="text-sm text-muted">לשימוש פנימי, לא מוצג לפני התאמה.</p>
      {candidates.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {candidates.map((c) => (
            <ChipToggle key={c} label={c} active={title === c} onClick={() => setTitle(c)} />
          ))}
        </div>
      )}
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label={fieldTitles.title} className={inputClass} />
    </EditDialog>
  );
}

function TargetRolesDialog({
  value,
  fields,
  targetRoles,
  onClose,
  onSave,
}: DialogProps & { fields: Option[]; targetRoles: TargetRoleOption[] }) {
  const [fieldId, setFieldId] = useState(value.professionalFieldId);
  const [roleIds, setRoleIds] = useState(value.targetRoleIds);
  // Scope chips to the chosen field, but never hide a role that's already
  // selected — the user shouldn't lose a valid selection to a filter.
  const visible = targetRoles.filter((r) => r.professionalFieldId === fieldId || roleIds.includes(r.id));
  return (
    <EditDialog
      title={fieldTitles.targetRoles}
      onClose={onClose}
      onSave={() => onSave({ professionalFieldId: fieldId, targetRoleIds: roleIds })}
    >
      <label className="block text-sm font-medium text-ink" htmlFor="review-field">
        תחום מקצועי
      </label>
      <select id="review-field" value={fieldId} onChange={(e) => setFieldId(e.target.value)} className={inputClass}>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.labelHe}
          </option>
        ))}
      </select>
      <p className="text-sm font-medium text-ink">ניתן לבחור יותר מאחד</p>
      <div className="flex flex-wrap gap-2">
        {visible.map((r) => (
          <ChipToggle
            key={r.id}
            label={r.labelHe}
            active={roleIds.includes(r.id)}
            onClick={() => setRoleIds((ids) => (ids.includes(r.id) ? ids.filter((x) => x !== r.id) : [...ids, r.id]))}
          />
        ))}
      </div>
    </EditDialog>
  );
}

function SummaryDialog({ value, extracted, onClose, onSave }: DialogProps & { extracted: StoredExtractedResumeData }) {
  const [text, setText] = useState(value.shortIntro);
  const suggestions = [...new Set([extracted.aiSummaryGuess, extracted.shortIntroGuess].filter((s): s is string => !!s))].filter(
    (s) => s !== text,
  );
  return (
    <EditDialog title={fieldTitles.summary} onClose={onClose} onSave={() => onSave({ shortIntro: text.trim() })}>
      <p className="text-sm text-muted">משפט היכרות קצר ואנונימי — מוצג למועמדים לפני אישור הדדי, בלי פרטים מזהים.</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 400))}
        rows={4}
        aria-label={fieldTitles.summary}
        className={inputClass}
      />
      <p className="text-left text-xs text-muted">{text.length}/400</p>
      {suggestions.map((s) => (
        <div key={s} className="rounded-xl border border-border bg-paper p-3 text-sm">
          <p className="text-muted">&quot;{s}&quot;</p>
          <button type="button" onClick={() => setText(s)} className="mt-2 text-sm font-medium text-primary hover:text-primary-dark">
            שימוש במשפט הזה
          </button>
        </div>
      ))}
    </EditDialog>
  );
}

function SkillsDialog({ value, skills, domains, onClose, onSave }: DialogProps & { skills: Option[]; domains: Option[] }) {
  const [tagIds, setTagIds] = useState(value.tagIds);
  const toggle = (id: string) => setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  return (
    <EditDialog title={fieldTitles.skills} onClose={onClose} onSave={() => onSave({ tagIds })}>
      <TagPicker label="כישורים וטכנולוגיות" options={skills} selected={tagIds} onToggle={toggle} />
      <TagPicker label="תחומים ותעשיות" options={domains} selected={tagIds} onToggle={toggle} />
    </EditDialog>
  );
}

function RegionDialog({ value, regions, onClose, onSave }: DialogProps & { regions: Option[] }) {
  const [regionId, setRegionId] = useState(value.regionId ?? "");
  return (
    <EditDialog title={fieldTitles.region} onClose={onClose} onSave={() => onSave({ regionId: regionId || null })}>
      <select autoFocus value={regionId} onChange={(e) => setRegionId(e.target.value)} aria-label={fieldTitles.region} className={inputClass}>
        <option value="">לא צוין</option>
        {regions
          .filter((r) => r.id)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.labelHe}
            </option>
          ))}
      </select>
    </EditDialog>
  );
}

function GenderDialog({ value, onClose, onSave }: DialogProps) {
  const [gender, setGender] = useState<Gender>(value.gender ?? "MALE");
  return (
    <EditDialog title={fieldTitles.gender} onClose={onClose} onSave={() => onSave({ gender })}>
      <p className="text-sm text-muted">משמש רק כדי להתאים לפי העדפת המגדר של הצד השני — לא מוצג לפני אישור הדדי.</p>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(genderLabels) as [Gender, string][]).map(([g, label]) => (
          <ChipToggle key={g} label={label} active={gender === g} onClick={() => setGender(g)} />
        ))}
      </div>
    </EditDialog>
  );
}

function PreviousPositionDialog({
  position,
  onClose,
  onSave,
  onRemove,
}: {
  position: PreviousPosition | null;
  onClose: () => void;
  onSave: (position: PreviousPosition) => void;
  onRemove: (key: string) => void;
}) {
  const [draft, setDraft] = useState<PreviousPosition>(
    () => position ?? { key: crypto.randomUUID(), company: null, title: "", startMonth: "", endMonth: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const patch = (p: Partial<PreviousPosition>) => setDraft((d) => ({ ...d, ...p }));
  return (
    <EditDialog
      title={position ? "מקום עבודה קודם" : "הוספת מקום עבודה קודם"}
      onClose={onClose}
      onSave={() => {
        if (!isCompletePosition(draft)) return setError("יש להשלים חברה, תפקיד ותאריכים");
        onSave({ ...draft, title: draft.title.trim() });
      }}
      extraAction={
        position && (
          <button type="button" onClick={() => onRemove(position.key)} className="text-sm text-muted hover:text-danger">
            הסרה
          </button>
        )
      }
    >
      <CompanyPicker value={draft.company} onChange={(company) => patch({ company })} placeholder="שם החברה" />
      <input value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="תפקיד" aria-label="תפקיד" className={inputClass} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input type="month" value={draft.startMonth} onChange={(e) => patch({ startMonth: e.target.value })} aria-label="תאריך התחלה" className={inputClass} />
        <input type="month" value={draft.endMonth} onChange={(e) => patch({ endMonth: e.target.value })} aria-label="תאריך סיום" className={inputClass} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </EditDialog>
  );
}
