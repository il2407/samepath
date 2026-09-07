"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CompanyPicker, type CompanySelection } from "@/modules/companies/CompanyPicker";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { saveDraftAction, submitContributionAction } from "@/modules/interviews/actions";
import { interviewFormatLabels, interviewOutcomeLabels, interviewStageLabels } from "@/modules/interviews/labels";

type StageValue = keyof typeof interviewStageLabels;
type FormatValue = keyof typeof interviewFormatLabels;
type OutcomeValue = keyof typeof interviewOutcomeLabels;

interface QuestionRow {
  key: string;
  text: string;
  isFollowUp: boolean;
}

interface StageRow {
  key: string;
  stage: StageValue;
  format: FormatValue;
  approxDurationMinutes: string;
  questions: QuestionRow[];
}

interface Option {
  id: string;
  labelHe: string;
}

export function ContributionForm({
  targetRoles,
  seniorityBands,
  regions,
  topics,
}: {
  targetRoles: Option[];
  seniorityBands: Option[];
  regions: Option[];
  topics: Option[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<"edit" | "attest">("edit");
  const [experienceId, setExperienceId] = useState<string | null>(null);

  const [company, setCompany] = useState<CompanySelection | null>(null);
  const [targetRoleId, setTargetRoleId] = useState("");
  const [seniorityBandId, setSeniorityBandId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodQuarter, setPeriodQuarter] = useState(1);
  const [processDescription, setProcessDescription] = useState("");
  const [whatIWishIKnew, setWhatIWishIKnew] = useState("");
  const [difficultyRating, setDifficultyRating] = useState(0);
  const [usefulnessRating, setUsefulnessRating] = useState(0);
  const [outcome, setOutcome] = useState<OutcomeValue | "">("");
  const [outcomeVisible, setOutcomeVisible] = useState(false);
  const [topicTagIds, setTopicTagIds] = useState<string[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);

  const [attestation, setAttestation] = useState({
    attestedOwnExperience: false,
    attestedTruthful: false,
    attestedPermitted: false,
    attestedNoConfidential: false,
    attestedParaphrased: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addStage() {
    setStages((rows) => [
      ...rows,
      { key: crypto.randomUUID(), stage: "TECHNICAL_SCREEN", format: "ONLINE", approxDurationMinutes: "", questions: [] },
    ]);
  }
  function updateStage(key: string, patch: Partial<StageRow>) {
    setStages((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeStage(key: string) {
    setStages((rows) => rows.filter((r) => r.key !== key));
  }
  function addQuestion(stageKey: string) {
    setStages((rows) =>
      rows.map((r) =>
        r.key === stageKey ? { ...r, questions: [...r.questions, { key: crypto.randomUUID(), text: "", isFollowUp: false }] } : r,
      ),
    );
  }
  function updateQuestion(stageKey: string, questionKey: string, patch: Partial<QuestionRow>) {
    setStages((rows) =>
      rows.map((r) =>
        r.key === stageKey
          ? { ...r, questions: r.questions.map((q) => (q.key === questionKey ? { ...q, ...patch } : q)) }
          : r,
      ),
    );
  }
  function removeQuestion(stageKey: string, questionKey: string) {
    setStages((rows) =>
      rows.map((r) => (r.key === stageKey ? { ...r, questions: r.questions.filter((q) => q.key !== questionKey) } : r)),
    );
  }
  function toggleTopic(id: string) {
    setTopicTagIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  function handleSaveAndContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!company) return setError("יש לבחור חברה");
    if (processDescription.trim().length < 20) return setError("נא לתאר את התהליך בפירוט רב יותר");

    const payload = {
      companyId: company.id,
      targetRoleId: targetRoleId || undefined,
      seniorityBandId: seniorityBandId || undefined,
      regionId: regionId || undefined,
      periodYear,
      periodQuarter,
      processDescription: processDescription.trim(),
      whatIWishIKnew: whatIWishIKnew.trim() || undefined,
      difficultyRating: difficultyRating || undefined,
      usefulnessRating: usefulnessRating || undefined,
      outcome: outcome || undefined,
      outcomeVisible,
      topicTagIds,
      stages: stages.map((s) => ({
        stage: s.stage,
        format: s.format,
        approxDurationMinutes: s.approxDurationMinutes ? Number(s.approxDurationMinutes) : undefined,
        questions: s.questions.filter((q) => q.text.trim()).map((q) => ({ text: q.text.trim(), isFollowUp: q.isFollowUp })),
      })),
    };

    startTransition(async () => {
      const result = await saveDraftAction(payload, experienceId ?? undefined);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      setExperienceId(result.experienceId ?? null);
      setStep("attest");
    });
  }

  function handleSubmit() {
    setError(null);
    if (!experienceId) return;
    if (!Object.values(attestation).every(Boolean)) return setError("יש לאשר את כל ההצהרות");

    startTransition(async () => {
      const result = await submitContributionAction(experienceId, attestation);
      if (!result.ok) {
        setError(result.error ?? "משהו השתבש");
        return;
      }
      router.push("/app/contributions");
    });
  }

  if (step === "attest") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-mint p-6">
          <h2 className="font-semibold text-ink">אישור לפני שליחה</h2>
          <p className="mt-2 text-sm text-ink/80">
            אין קרדיטים על עצם השליחה — רק לאחר אישור על ידי צוות המודרציה. אנא אשרו את כל הסעיפים הבאים:
          </p>
          <div className="mt-4 space-y-3">
            <AttestCheckbox
              label="זוהי חוויה אישית שלי"
              checked={attestation.attestedOwnExperience}
              onChange={(v) => setAttestation((a) => ({ ...a, attestedOwnExperience: v }))}
            />
            <AttestCheckbox
              label="המידע נכון למיטב זיכרוני"
              checked={attestation.attestedTruthful}
              onChange={(v) => setAttestation((a) => ({ ...a, attestedTruthful: v }))}
            />
            <AttestCheckbox
              label="מותר לי לשתף מידע זה"
              checked={attestation.attestedPermitted}
              onChange={(v) => setAttestation((a) => ({ ...a, attestedPermitted: v }))}
            />
            <AttestCheckbox
              label="אינו מפר NDA, כללי מטלת בית, או סודיות אחרת, ואינו מכיל מידע אישי, חסוי, או קבצים של מטלה"
              checked={attestation.attestedNoConfidential}
              onChange={(v) => setAttestation((a) => ({ ...a, attestedNoConfidential: v }))}
            />
            <AttestCheckbox
              label="השאלות נוסחו מחדש במילים שלי במידת האפשר"
              checked={attestation.attestedParaphrased}
              onChange={(v) => setAttestation((a) => ({ ...a, attestedParaphrased: v }))}
            />
          </div>
          <p className="mt-4 text-xs text-muted">
            אישור זה אינו ייעוץ משפטי ואינו ערובה שהפרסום חוקי בכל מקרה — האחריות על תוכן השיתוף היא שלכם.
          </p>
        </div>

        {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">{error}</p>}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setStep("edit")} disabled={pending} className="px-4 py-2 text-sm">
            חזרה לעריכה
          </Button>
          <Button onClick={handleSubmit} disabled={pending} className="px-4 py-2 text-sm">
            {pending ? "שולח…" : "שליחה לבדיקה"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveAndContinue} className="space-y-8" noValidate>
      <section className="space-y-4">
        <h2 className="font-semibold text-ink">פרטי התהליך</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <CompanyPicker value={company} onChange={setCompany} placeholder="שם החברה" />
          <select value={targetRoleId} onChange={(e) => setTargetRoleId(e.target.value)} className="rounded-xl border border-border bg-white px-4 py-3">
            <option value="">משפחת תפקיד (לא חובה)</option>
            {targetRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.labelHe}
              </option>
            ))}
          </select>
          <select value={seniorityBandId} onChange={(e) => setSeniorityBandId(e.target.value)} className="rounded-xl border border-border bg-white px-4 py-3">
            <option value="">רמת ותק (לא חובה)</option>
            {seniorityBands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.labelHe}
              </option>
            ))}
          </select>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="rounded-xl border border-border bg-white px-4 py-3">
            <option value="">אזור (לא חובה)</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.labelHe}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              value={periodYear}
              onChange={(e) => setPeriodYear(Number(e.target.value))}
              className="w-1/2 rounded-xl border border-border bg-white px-4 py-3"
              aria-label="שנה משוערת"
            />
            <select value={periodQuarter} onChange={(e) => setPeriodQuarter(Number(e.target.value))} className="w-1/2 rounded-xl border border-border bg-white px-4 py-3">
              <option value={1}>רבעון 1</option>
              <option value={2}>רבעון 2</option>
              <option value={3}>רבעון 3</option>
              <option value={4}>רבעון 4</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">תקופה משוערת בלבד (רבעון) — לא תאריך מדויק.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">תיאור התהליך</h2>
        <textarea
          value={processDescription}
          onChange={(e) => setProcessDescription(e.target.value)}
          rows={4}
          placeholder="תארו את מהלך התהליך הכללי, בלי שמות של אנשים או פרטים מזהים."
          className="w-full rounded-xl border border-border bg-white px-4 py-3"
        />
        <textarea
          value={whatIWishIKnew}
          onChange={(e) => setWhatIWishIKnew(e.target.value)}
          rows={2}
          placeholder="מה הייתם רוצים לדעת מראש? (לא חובה)"
          className="w-full rounded-xl border border-border bg-white px-4 py-3"
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">שלבי הראיון</h2>
          <button type="button" onClick={addStage} className="text-sm font-medium text-primary hover:text-primary-dark">
            + הוספת שלב
          </button>
        </div>
        {stages.map((stage) => (
          <div key={stage.key} className="space-y-3 rounded-2xl border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <select value={stage.stage} onChange={(e) => updateStage(stage.key, { stage: e.target.value as StageValue })} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                {Object.entries(interviewStageLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select value={stage.format} onChange={(e) => updateStage(stage.key, { format: e.target.value as FormatValue })} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                {Object.entries(interviewFormatLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={stage.approxDurationMinutes}
                onChange={(e) => updateStage(stage.key, { approxDurationMinutes: e.target.value })}
                placeholder="משך בדקות (משוער)"
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              />
            </div>

            {stage.questions.map((q) => (
              <div key={q.key} className="flex items-start gap-2">
                <textarea
                  value={q.text}
                  onChange={(e) => updateQuestion(stage.key, q.key, { text: e.target.value })}
                  placeholder="שאלה מנוסחת מחדש (paraphrased)"
                  rows={2}
                  className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-1 whitespace-nowrap pt-2 text-xs text-muted">
                  <input type="checkbox" checked={q.isFollowUp} onChange={(e) => updateQuestion(stage.key, q.key, { isFollowUp: e.target.checked })} />
                  שאלת המשך
                </label>
                <button type="button" onClick={() => removeQuestion(stage.key, q.key)} className="pt-2 text-xs text-muted hover:text-danger">
                  הסרה
                </button>
              </div>
            ))}
            <button type="button" onClick={() => addQuestion(stage.key)} className="text-sm text-primary hover:text-primary-dark">
              + הוספת שאלה
            </button>

            <div>
              <button type="button" onClick={() => removeStage(stage.key)} className="text-sm text-muted hover:text-danger">
                הסרת שלב
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">נושאים</h2>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTopic(t.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm",
                topicTagIds.includes(t.id) ? "border-primary bg-mint text-primary-dark" : "border-border bg-white text-ink hover:border-primary",
              )}
            >
              {t.labelHe}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-ink">דירוגים ותוצאה (לא חובה)</h2>
        <RatingField label="רמת קושי" value={difficultyRating} onChange={setDifficultyRating} />
        <RatingField label="עד כמה מועיל לשתף" value={usefulnessRating} onChange={setUsefulnessRating} />
        <div>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as OutcomeValue | "")} className="rounded-xl border border-border bg-white px-4 py-3">
            <option value="">תוצאה (לא חובה, מוסתר כברירת מחדל)</option>
            {Object.entries(interviewOutcomeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {outcome && (
            <label className="mt-2 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={outcomeVisible} onChange={(e) => setOutcomeVisible(e.target.checked)} />
              לפרסם את התוצאה (רק אם זה לא עלול לחשוף אתכם)
            </label>
          )}
        </div>
      </section>

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger-dark">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "שומר…" : "המשך לאישור ושליחה"}
      </Button>
    </form>
  );
}

function AttestCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4" />
      {label}
    </label>
  );
}

function RatingField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-ink">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border text-sm",
              value >= n ? "border-primary bg-mint text-primary-dark" : "border-border bg-white text-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
