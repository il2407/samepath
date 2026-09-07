import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { prisma } from "@/shared/db";
import { PrivacyStepForm } from "@/modules/profiles/PrivacyStepForm";
import { getOwnProfilePhotoDataUrl } from "@/modules/profiles/photo";

export const metadata: Metadata = { title: "הגדרות פרטיות — SamePath" };

export default async function OnboardingPrivacyPage() {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  if (step === "profile") redirect("/app/onboarding/profile");
  if (step === "preferences") redirect("/app/onboarding/preferences");
  if (step === "done") redirect("/app");

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: user.id },
    include: { currentCompany: true, disclosurePreference: true },
  });
  const photoDataUrl = await getOwnProfilePhotoDataUrl(user.id);

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
