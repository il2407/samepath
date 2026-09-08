import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep, getOnboardingOverviewData } from "@/modules/profiles/service";
import { listLanguages } from "@/modules/reference-data/service";
import { PreferencesStepForm, type PreferencesStepInitial } from "@/modules/profiles/PreferencesStepForm";

export const metadata: Metadata = { title: "העדפות חיבור — SamePath" };

export default async function OnboardingPreferencesPage({ searchParams }: PageProps<"/app/onboarding/preferences">) {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  const { edit } = await searchParams;

  // Same back-navigation fix as the earlier steps: completeConnectionPreferences
  // already moves the profile past this step (connectionPreference gets
  // created), so getOnboardingStep can never return "preferences" again
  // afterward. ?edit=true is the explicit signal that this is a deliberate re-edit.
  const isReEditing = edit === "true" && step !== "profile" && step !== "privacy" && step !== "preferences";

  if (!isReEditing) {
    if (step === "profile") redirect("/app/onboarding/profile");
    if (step === "privacy") redirect("/app/onboarding/privacy");
    if (step === "overview") redirect("/app/onboarding/overview");
    if (step === "done") redirect("/app");
  }

  const languages = await listLanguages();
  const mappedLanguages = languages.map((l) => ({ id: l.id, labelHe: l.labelHe }));

  if (isReEditing) {
    const data = await getOnboardingOverviewData(user.id);
    if (!data) redirect("/app/onboarding/preferences");
    const { profile } = data;
    const cp = profile.connectionPreference;

    const initial: PreferencesStepInitial | undefined = cp
      ? {
          peerMinExperienceMonths: cp.peerMinExperienceMonths,
          peerMaxExperienceMonths: cp.peerMaxExperienceMonths,
          format: cp.format,
          cadence: cp.cadence,
          mode: cp.mode,
          genderPreference: cp.genderPreference,
          languageId: cp.languageId,
          reasons: cp.reasons,
          availability: profile.availabilitySlots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
          })),
        }
      : undefined;

    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">עריכת העדפות חיבור</h1>
        <p className="mt-2 text-muted">אפשר לתקן כל שדה ולהמשיך הלאה.</p>
        <div className="mt-8">
          <PreferencesStepForm languages={mappedLanguages} initial={initial} submitLabel="שמירה והמשך" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">איך תרצו להתחבר</h1>
      <p className="mt-2 text-muted">
        השלב האחרון לפני סקירה — לאחריה תוכלו לאשר ולהפעיל את הפרופיל ולהתחיל לראות הצעות התאמה אנונימיות.
      </p>
      <div className="mt-8">
        <PreferencesStepForm languages={mappedLanguages} />
      </div>
    </div>
  );
}
