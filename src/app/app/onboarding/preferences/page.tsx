import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { listLanguages } from "@/modules/reference-data/service";
import { PreferencesStepForm } from "@/modules/profiles/PreferencesStepForm";

export const metadata: Metadata = { title: "העדפות חיבור — SamePath" };

export default async function OnboardingPreferencesPage() {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  if (step === "profile") redirect("/app/onboarding/profile");
  if (step === "privacy") redirect("/app/onboarding/privacy");
  if (step === "done") redirect("/app");

  const languages = await listLanguages();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">איך תרצו להתחבר</h1>
      <p className="mt-2 text-muted">
        השלב האחרון — לאחריו הפרופיל יופעל ותתחילו לראות הצעות התאמה אנונימיות.
      </p>
      <div className="mt-8">
        <PreferencesStepForm languages={languages.map((l) => ({ id: l.id, labelHe: l.labelHe }))} />
      </div>
    </div>
  );
}
