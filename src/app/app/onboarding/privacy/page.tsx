import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep, getPrivacySettings } from "@/modules/profiles/service";
import { prisma } from "@/shared/db";
import { PrivacyStepForm, type PrivacyStepInitial } from "@/modules/profiles/PrivacyStepForm";
import { getOwnProfilePhotoDataUrl } from "@/modules/profiles/photo";
import { loadRawProfileForDto } from "@/modules/profiles/dto-loader";
import { toPreMatchDTO } from "@/modules/profiles/dto";
import { generateFriendlyNickname } from "@/modules/profiles/nickname";
import { getLatestResumeDraftData } from "@/modules/resumes/service";

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

  // Company visibility is deliberately ignored here (toPreMatchDTO's second
  // argument) — the form shows/hides the employer name itself based on the
  // live shareCompanyPreMatch toggle, so the DTO's own gating would just be
  // redundant with what the client already does.
  const rawProfile = await loadRawProfileForDto(user.id);
  const previewCandidate = rawProfile ? toPreMatchDTO(rawProfile, false) : null;
  const previewNickname = generateFriendlyNickname(`preview:${user.id}`);

  if (isReEditing) {
    const settings = await getPrivacySettings(user.id);
    if (!settings) redirect("/app/onboarding/privacy");
    const { profile, blockedCompanies } = settings;

    const initial: PrivacyStepInitial = {
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
            previewCandidate={previewCandidate}
            previewNickname={previewNickname}
          />
        </div>
      </div>
    );
  }

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: user.id },
    include: { currentCompany: true, disclosurePreference: true },
  });

  // The privacy step hasn't been filled in yet at this point (that's what
  // disclosurePreference being unset means here), so pre-fill its name /
  // phone fields from the resume's best-effort guesses, if a resume was
  // uploaded earlier in onboarding — the user still reviews and can edit or
  // clear every field before it's saved.
  const resumeDraft = await getLatestResumeDraftData(user.id);
  const initial: PrivacyStepInitial | undefined = resumeDraft
    ? {
        blockedCompanies: [],
        fullName: resumeDraft.fullNameGuess ?? "",
        shareCompanyPreMatch: false,
        shareFullNamePostMatch: false,
        phoneNumber: resumeDraft.phoneGuess ?? "",
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">הגדרות פרטיות</h1>
      <p className="mt-2 text-muted">ניתן לשינוי בכל שלב, גם אחרי ההרשמה.</p>
      <div className="mt-8">
        <PrivacyStepForm
          currentCompanyName={profile?.currentCompany?.canonicalName ?? null}
          currentPhotoDataUrl={photoDataUrl}
          initialSharePhotoPostMatch={profile?.disclosurePreference?.sharePhotoPostMatch ?? false}
          initial={initial}
          previewCandidate={previewCandidate}
          previewNickname={previewNickname}
        />
      </div>
    </div>
  );
}
