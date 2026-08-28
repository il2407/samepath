import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { loadOnboardingFormOptions } from "@/modules/reference-data/service";
import { getResumeStatusForUser } from "@/modules/resumes/service";
import { ProfileStepOneForm, type ProfileStepOneInitialData } from "@/modules/profiles/ProfileStepOneForm";
import { ResumeUploadCard } from "@/modules/resumes/ResumeUploadCard";
import { ResumeDraftReview } from "@/modules/resumes/ResumeDraftReview";

export const metadata: Metadata = { title: "פרופיל מקצועי — SamePath" };

export default async function OnboardingProfilePage() {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  if (step === "privacy") redirect("/app/onboarding/privacy");
  if (step === "preferences") redirect("/app/onboarding/preferences");
  if (step === "done") redirect("/app");

  const [options, resumeStatus] = await Promise.all([loadOnboardingFormOptions(), getResumeStatusForUser(user.id)]);

  const fields = options.fields.map((f) => ({ id: f.id, labelHe: f.labelHe }));
  const targetRoles = options.targetRoles.map((r) => ({ id: r.id, labelHe: r.labelHe, professionalFieldId: r.professionalFieldId }));
  const regions = options.regions.map((r) => ({ id: r.id, labelHe: r.labelHe }));
  const skills = options.skills.map((s) => ({ id: s.id, labelHe: s.labelHe }));
  const domains = options.domains.map((d) => ({ id: d.id, labelHe: d.labelHe }));
  const languages = options.languages.map((l) => ({ id: l.id, labelHe: l.labelHe }));

  const draft = resumeStatus?.draft;
  let initialFromDraft: ProfileStepOneInitialData | undefined;

  if (draft) {
    const extracted = draft.extracted;
    const current = extracted.positions.find((p) => p.isCurrent) ?? null;
    const previous = extracted.positions.filter((p) => p !== current);

    initialFromDraft = {
      // Not extractable from a resume with any confidence — default to the
      // first field so the target-role chips have something to filter by;
      // the user still has to pick roles explicitly (required below).
      professionalFieldId: fields[0]?.id ?? "",
      targetRoleIds: [],
      currentRoleTitle: extracted.currentRoleTitleGuess ?? current?.title ?? "",
      regionId: null,
      shortIntro: "",
      tagIds: extracted.matchedTagIds,
      languageIds: extracted.matchedLanguageIds,
      currentCompany: current ? { id: current.companyId, canonicalName: current.companyName } : null,
      currentStartMonth: current?.startMonth ?? "",
      previousPositions: previous.map((p, index) => ({
        key: `resume-${index}`,
        company: { id: p.companyId, canonicalName: p.companyName },
        title: p.title,
        startMonth: p.startMonth,
        endMonth: p.endMonth ?? "",
      })),
    };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">בואו נכיר את הפרופיל המקצועי שלכם</h1>
      <p className="mt-2 text-muted">
        המידע כאן אינו ציבורי. לפני אישור הדדי עם מועמד/ת יוצג רק מידע כללי — לא שם, לא תמונה ולא
        מעסיק. את שם החברה הנוכחית תאשרו בשלב הבא.
      </p>

      {resumeStatus?.uploadId && draft && (
        <div className="mt-8">
          <ResumeDraftReview
            uploadId={resumeStatus.uploadId}
            originalFilename={resumeStatus.originalFilename}
            initial={initialFromDraft!}
            fields={fields}
            targetRoles={targetRoles}
            regions={regions}
            skills={skills}
            domains={domains}
            languages={languages}
          />
        </div>
      )}

      {!draft && (
        <>
          <div className="mt-8">
            <ResumeUploadCard extractionFailed={resumeStatus?.extractionFailed ?? false} />
          </div>
          <div className="mt-8">
            <ProfileStepOneForm
              fields={fields}
              targetRoles={targetRoles}
              regions={regions}
              skills={skills}
              domains={domains}
              languages={languages}
            />
          </div>
        </>
      )}
    </div>
  );
}
