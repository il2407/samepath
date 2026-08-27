import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { loadOnboardingFormOptions } from "@/modules/reference-data/service";
import { ProfileStepOneForm } from "@/modules/profiles/ProfileStepOneForm";

export const metadata: Metadata = { title: "פרופיל מקצועי — SamePath" };

export default async function OnboardingProfilePage() {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  if (step === "privacy") redirect("/app/onboarding/privacy");
  if (step === "preferences") redirect("/app/onboarding/preferences");
  if (step === "done") redirect("/app");

  const options = await loadOnboardingFormOptions();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">בואו נכיר את הפרופיל המקצועי שלכם</h1>
      <p className="mt-2 text-muted">
        המידע כאן אינו ציבורי. לפני אישור הדדי עם מועמד/ת יוצג רק מידע כללי — לא שם, לא תמונה ולא
        מעסיק. את שם החברה הנוכחית תאשרו בשלב הבא.
      </p>
      <div className="mt-8">
        <ProfileStepOneForm
          fields={options.fields.map((f) => ({ id: f.id, labelHe: f.labelHe }))}
          targetRoles={options.targetRoles.map((r) => ({
            id: r.id,
            labelHe: r.labelHe,
            professionalFieldId: r.professionalFieldId,
          }))}
          regions={options.regions.map((r) => ({ id: r.id, labelHe: r.labelHe }))}
          skills={options.skills.map((s) => ({ id: s.id, labelHe: s.labelHe }))}
          domains={options.domains.map((d) => ({ id: d.id, labelHe: d.labelHe }))}
          languages={options.languages.map((l) => ({ id: l.id, labelHe: l.labelHe }))}
        />
      </div>
    </div>
  );
}
