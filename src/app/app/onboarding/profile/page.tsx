import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep, getProfileEditData } from "@/modules/profiles/service";
import { loadOnboardingFormOptions } from "@/modules/reference-data/service";
import { getResumeStatusForUser } from "@/modules/resumes/service";
import { ProfileStepOneForm, type ProfileStepOneInitialData } from "@/modules/profiles/ProfileStepOneForm";
import { ResumeUploadCard } from "@/modules/resumes/ResumeUploadCard";
import { ResumeDraftReview } from "@/modules/resumes/ResumeDraftReview";

export const metadata: Metadata = { title: "פרופיל מקצועי — SamePath" };

function toMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function OnboardingProfilePage({ searchParams }: PageProps<"/app/onboarding/profile">) {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  const { edit } = await searchParams;

  // Back-navigation fix: saveProfileStepOne flips ProfessionalProfile.status
  // off DRAFT the moment step 1 is first saved, so getOnboardingStep can
  // never return "profile" again afterward — the forward guard below would
  // otherwise bounce a user who deliberately comes back here (e.g. the
  // "back to edit profile" link on the privacy step) straight back to
  // whichever step they're actually on, making that link a dead end/redirect
  // loop. `?edit=true` is the explicit signal that this navigation is a
  // deliberate re-edit of an already-completed step 1, not someone who
  // hasn't done it yet — it's only honored once a profile actually exists
  // (step !== "profile"), so a first-time visitor is unaffected either way.
  const isReEditing = edit === "true" && step !== "profile";

  if (!isReEditing) {
    if (step === "privacy") redirect("/app/onboarding/privacy");
    if (step === "preferences") redirect("/app/onboarding/preferences");
    if (step === "overview") redirect("/app/onboarding/overview");
    if (step === "done") redirect("/app");
  }

  const options = await loadOnboardingFormOptions();

  const fields = options.fields.map((f) => ({ id: f.id, labelHe: f.labelHe }));
  const targetRoles = options.targetRoles.map((r) => ({ id: r.id, labelHe: r.labelHe, professionalFieldId: r.professionalFieldId }));
  const regions = options.regions.map((r) => ({ id: r.id, labelHe: r.labelHe }));
  const skills = options.skills.map((s) => ({ id: s.id, labelHe: s.labelHe }));
  const domains = options.domains.map((d) => ({ id: d.id, labelHe: d.labelHe }));
  const languages = options.languages.map((l) => ({ id: l.id, labelHe: l.labelHe }));

  // Re-editing an already-completed step 1: pre-fill from the real saved
  // profile (the same pattern /app/settings/profile uses), not from any
  // resume draft — by the time a profile can be re-edited from a later
  // step, any resume draft that fed step 1 the first time has already been
  // confirmed (or the user could never have gotten past step 1), so there
  // is never an unconfirmed draft left to show here.
  if (isReEditing) {
    const profile = await getProfileEditData(user.id);
    // getOnboardingStep only returns anything other than "profile" once a
    // ProfessionalProfile row exists, and isReEditing requires exactly that.
    if (!profile) redirect("/app/onboarding/profile");

    const currentPosition = profile.employmentPositions.find((p) => p.isCurrent) ?? null;
    const previousPositions = profile.employmentPositions.filter((p) => !p.isCurrent);

    const initial: ProfileStepOneInitialData = {
      professionalFieldId: profile.professionalFieldId ?? "",
      targetRoleIds: profile.targetRoles.map((r) => r.targetRoleId),
      currentRoleTitle: profile.currentRoleTitle ?? "",
      regionId: profile.regionId,
      shortIntro: profile.shortIntro ?? "",
      tagIds: profile.tags.map((t) => t.tagId),
      languageIds: profile.languages.map((l) => l.languageId),
      gender: profile.gender,
      currentCompany: currentPosition?.company
        ? { id: currentPosition.company.id, canonicalName: currentPosition.company.canonicalName }
        : null,
      currentStartMonth: currentPosition ? toMonthString(currentPosition.startDate) : "",
      previousPositions: previousPositions.map((p) => ({
        key: p.id,
        company: p.company ? { id: p.company.id, canonicalName: p.company.canonicalName } : null,
        title: p.title,
        startMonth: toMonthString(p.startDate),
        endMonth: p.endDate ? toMonthString(p.endDate) : "",
      })),
    };

    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">עריכת הפרופיל המקצועי</h1>
        <p className="mt-2 text-muted">
          אפשר לתקן כל שדה ולהמשיך הלאה — שינוי המעסיק הנוכחי בלבד ידרוש אישור מחדש בשלב הפרטיות.
        </p>
        <div className="mt-8">
          <ProfileStepOneForm
            fields={fields}
            targetRoles={targetRoles}
            regions={regions}
            skills={skills}
            domains={domains}
            languages={languages}
            initial={initial}
            submitLabel="שמירה והמשך"
          />
        </div>
      </div>
    );
  }

  const resumeStatus = await getResumeStatusForUser(user.id);
  const draft = resumeStatus?.draft;
  let initialFromDraft: ProfileStepOneInitialData | undefined;

  if (draft) {
    const extracted = draft.extracted;
    const current = extracted.positions.find((p) => p.isCurrent) ?? null;
    const previous = extracted.positions.filter((p) => p !== current);

    initialFromDraft = {
      // professionalFieldIdGuess is only ever set when a known target-role
      // label was found verbatim in the text (see deterministic-parser.ts) —
      // falling back to the first field otherwise so the target-role chips
      // have something to filter by; the user still has to pick roles
      // explicitly either way (required below).
      professionalFieldId: extracted.professionalFieldIdGuess ?? fields[0]?.id ?? "",
      targetRoleIds: extracted.matchedTargetRoleIds,
      currentRoleTitle: extracted.currentRoleTitleGuess ?? current?.title ?? "",
      regionId: extracted.matchedRegionId,
      shortIntro: extracted.shortIntroGuess ?? "",
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
            <ResumeUploadCard
              extractionFailed={resumeStatus?.extractionFailed ?? false}
              extractionFailureReason={resumeStatus?.extractionFailureReason ?? null}
              failedUploadId={resumeStatus?.extractionFailed ? resumeStatus.uploadId : undefined}
            />
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
