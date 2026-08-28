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
        <button type="button" disabled={pending} onClick={discard} className="text-sm text-muted hover:text-red-600">
          מחיקת הטיוטה והתחלה ידנית
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        עברו על השדות למטה ותקנו כרצונכם — שום דבר לא נשמר עד שתלחצו על הכפתור בתחתית הטופס.
      </p>
      {discardError && <p className="mt-2 text-sm text-red-600">{discardError}</p>}

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
