import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep, getPrivacySettings } from "@/modules/profiles/service";
import { prisma } from "@/shared/db";
import { PrivacyStepForm, type PrivacyStepInitial } from "@/modules/profiles/PrivacyStepForm";
import { getOwnProfilePhotoDataUrl } from "@/modules/profiles/photo";

export const metadata: Metadata = { title: "הגדרות פרטיות — SamePath" };

export default async function OnboardingPrivacyPage({ searchParams }: PageProps<"/app/onboarding/privacy">) {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  const { edit } = await searchParams;

  // Same back-navigation fix as the profile step: completePrivacyOnboarding
  // already moves the profile past this step (currentCompanyConfirmedAt gets
  // set), so getOnboardingStep can never return "privacy" again afterward.
  // ?edit=true is the explicit signal that this is a deliberate re-edit.
  const isReEditing = edit === "true" && step !== "profile" && step !== "privacy";

  if (!isReEditing) {
    if (step === "profile") redirect("/app/onboarding/profile");
    if (step === "preferences") redirect("/app/onboarding/preferences");
    if (step === "overview") redirect("/app/onboarding/overview");
    if (step === "done") redirect("/app");
  }

  const photoDataUrl = await getOwnProfilePhotoDataUrl(user.id);

  if (isReEditing) {
    const settings = await getPrivacySettings(user.id);
    if (!settings) redirect("/app/onboarding/privacy");
    const { profile, blockedCompanies } = settings;

    const initial: PrivacyStepInitial = {
      employerConfirmed: true,
      blockedCompanies: blockedCompanies
        .filter((b) => b.company)
        .map((b) => ({ company: b.company!, reason: b.reason })),
      fullName: profile?.disclosurePreference?.fullName ?? "",
      shareCompanyPreMatch: profile?.disclosurePreference?.shareCompanyPreMatch ?? false,
      shareFullNamePostMatch: profile?.disclosurePreference?.shareFullNamePostMatch ?? false,
      phoneNumber: profile?.disclosurePreference?.phoneNumber ?? "",
    };

    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">עריכת הגדרות פרטיות</h1>
        <p className="mt-2 text-muted">אפשר לתקן כל שדה ולהמשיך הלאה.</p>
        <div className="mt-8">
          <PrivacyStepForm
            currentCompanyName={profile?.currentCompany?.canonicalName ?? null}
            currentPhotoDataUrl={photoDataUrl}
            initialSharePhotoPostMatch={profile?.disclosurePreference?.sharePhotoPostMatch ?? false}
            initial={initial}
            submitLabel="שמירה והמשך"
          />
        </div>
      </div>
    );
  }

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: user.id },
    include: { currentCompany: true, disclosurePreference: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">הגדרות פרטיות</h1>
      <p className="mt-2 text-muted">שלב חובה לפני הפעלת הפרופיל. כל שדה מוסבר בעברית פשוטה.</p>
      <div className="mt-8">
        <PrivacyStepForm
          currentCompanyName={profile?.currentCompany?.canonicalName ?? null}
          currentPhotoDataUrl={photoDataUrl}
          initialSharePhotoPostMatch={profile?.disclosurePreference?.sharePhotoPostMatch ?? false}
        />
      </div>
    </div>
  );
}
