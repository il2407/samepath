import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getPrivacySettings } from "@/modules/profiles/service";
import { getOwnProfilePhotoDataUrl } from "@/modules/profiles/photo";
import { PrivacySettingsForm } from "@/modules/profiles/PrivacySettingsForm";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "הגדרות פרטיות — SamePath" };

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const data = await getPrivacySettings(user.id);
  if (!data) redirect("/app/onboarding/profile");

  const { profile, blockedCompanies } = data;
  const photoDataUrl = await getOwnProfilePhotoDataUrl(user.id);

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">הגדרות פרטיות</h1>
      <p className="mt-2 text-muted">
        המעסיק הנוכחי שלכם:{" "}
        <strong className="text-ink">{profile.currentCompany?.canonicalName ?? "לא הוגדר"}</strong>
      </p>

      <div className="mt-8">
        <PrivacySettingsForm
          initial={{
            blockEntireCorporateGroup: profile.privacyPreference?.blockEntireCorporateGroup ?? true,
            blockedCompanies: blockedCompanies.map((b) => ({
              company: { id: b.company.id, canonicalName: b.company.canonicalName },
              reason: b.reason,
            })),
            fullName: profile.disclosurePreference?.fullName ?? "",
            shareCompanyPreMatch: profile.disclosurePreference?.shareCompanyPreMatch ?? false,
            shareFullNamePostMatch: profile.disclosurePreference?.shareFullNamePostMatch ?? false,
            photoDataUrl,
            sharePhotoPostMatch: profile.disclosurePreference?.sharePhotoPostMatch ?? false,
            shareLinkedInPostMatch: profile.disclosurePreference?.shareLinkedInPostMatch ?? false,
            linkedInUrl: profile.disclosurePreference?.linkedInUrl ?? "",
            sharePreciseLocationPostMatch: profile.disclosurePreference?.sharePreciseLocationPostMatch ?? false,
            shareEmailPostMatch: profile.disclosurePreference?.shareEmailPostMatch ?? false,
            sharePhonePostMatch: profile.disclosurePreference?.sharePhonePostMatch ?? false,
            phoneNumber: profile.disclosurePreference?.phoneNumber ?? "",
            resumeRetentionPreference: profile.resumeRetentionPreference,
          }}
        />
      </div>
    </Container>
  );
}
