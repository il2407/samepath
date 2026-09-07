"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ProfileStepOneForm, type ProfileStepOneInitialData } from "@/modules/profiles/ProfileStepOneForm";
import { confirmResumeDraftAction, discardResumeDraftAction, type ActionState } from "@/modules/resumes/actions";

interface Option {
  id: string;
  labelHe: string;
}

interface TargetRoleOption extends Option {
  professionalFieldId: string;
}

export function ResumeDraftReview({
  uploadId,
  originalFilename,
  initial,
  fields,
  targetRoles,
  regions,
  skills,
  domains,
  languages,
}: {
  uploadId: string;
  originalFilename: string;
  initial: ProfileStepOneInitialData;
  fields: Option[];
  targetRoles: TargetRoleOption[];
  regions: Option[];
  skills: Option[];
  domains: Option[];
  languages: Option[];
}) {
  const router = useRouter();
  const [keepFile, setKeepFile] = useState(false);
  const [pending, startTransition] = useTransition();
  const [discardError, setDiscardError] = useState<string | null>(null);

  async function onSave(profileInput: unknown): Promise<ActionState> {
    return confirmResumeDraftAction({ uploadId, keepFile, profile: profileInput });
  }

  function discard() {
    setDiscardError(null);
    startTransition(async () => {
      const result = await discardResumeDraftAction(uploadId);
      if (!result.ok) return setDiscardError(result.error ?? "משהו השתבש");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">טיוטה מתוך {originalFilename}</h2>
        <button type="button" disabled={pending} onClick={discard} className="text-sm text-muted hover:text-danger">
          מחיקת הטיוטה והתחלה ידנית
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        עברו על השדות למטה ותקנו כרצונכם — שום דבר לא נשמר עד שתלחצו על הכפתור בתחתית הטופס.
      </p>
      {discardError && <p className="mt-2 text-sm text-danger">{discardError}</p>}

      <ExtractionSummary initial={initial} />

      <div className="mt-4 rounded-xl bg-paper p-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} />
          לשמור את קובץ קורות החיים המקורי במערכת (ברירת המחדל: הקובץ נמחק לאחר האישור)
        </label>
      </div>

      <div className="mt-6">
        <ProfileStepOneForm
          fields={fields}
          targetRoles={targetRoles}
          regions={regions}
          skills={skills}
          domains={domains}
          languages={languages}
          initial={initial}
          onSave={onSave}
          submitLabel="אישור ושמירת הפרופיל"
        />
      </div>
    </div>
  );
}

/**
 * A best-effort extraction is only trustworthy if it's honest about its own
 * gaps (§10/§11 — never present a "nothing found" field as if it were a
 * confident answer, and let the user tell the two apart at a glance). This
 * doesn't touch ProfileStepOneForm's own fields — it's a plain summary
 * banner above the form, listing what the parser actually found in the file
 * versus what it found no signal for and left for manual entry.
 */
function ExtractionSummary({ initial }: { initial: ProfileStepOneInitialData }) {
  const found: string[] = [];
  const missing: string[] = [];

  if (initial.currentCompany) found.push("חברה נוכחית ותאריך התחלה");
  else missing.push("חברה נוכחית");

  if (initial.previousPositions.length > 0) found.push(`${initial.previousPositions.length} תפקידים קודמים`);
  if (initial.targetRoleIds.length > 0) found.push("תפקיד/י יעד מוצעים");
  else missing.push("תפקיד/י יעד");

  if (initial.tagIds.length > 0) found.push(`${initial.tagIds.length} כישורים/תחומים`);
  if (initial.languageIds.length > 0) found.push(`${initial.languageIds.length} שפות`);
  if (initial.regionId) found.push("אזור מגורים");
  else missing.push("אזור מגורים");

  if (initial.shortIntro) found.push("טיוטת היכרות קצרה");
  else missing.push("היכרות קצרה");

  if (found.length === 0 && missing.length === 0) return null;

  return (
    <div className="mt-4 space-y-1 rounded-xl border border-border bg-paper p-3 text-sm">
      {found.length > 0 && (
        <p className="text-ink">
          <span className="font-medium text-happy-dark">זיהינו אוטומטית מהקובץ: </span>
          {found.join(" · ")} — כדאי לוודא שהכול נכון לפני האישור.
        </p>
      )}
      {missing.length > 0 && (
        <p className="text-muted">
          <span className="font-medium">לא זוהה אוטומטית, יש להשלים ידנית: </span>
          {missing.join(" · ")}
        </p>
      )}
    </div>
  );
}
