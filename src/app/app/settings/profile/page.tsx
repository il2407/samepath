import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getProfileEditData } from "@/modules/profiles/service";
import { loadOnboardingFormOptions } from "@/modules/reference-data/service";
import { ProfileStepOneForm } from "@/modules/profiles/ProfileStepOneForm";
import { updateProfileSettingsAction } from "@/modules/profiles/actions";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "עריכת פרופיל — SamePath" };

function toMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const [profile, options] = await Promise.all([getProfileEditData(user.id), loadOnboardingFormOptions()]);
  if (!profile) redirect("/app/onboarding/profile");

  const currentPosition = profile.employmentPositions.find((p) => p.isCurrent) ?? null;
  const previousPositions = profile.employmentPositions.filter((p) => !p.isCurrent);

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">עריכת פרופיל מקצועי</h1>
      <p className="mt-2 text-muted">
        לשינוי המעסיק הנוכחי תידרש אישור מחדש בהגדרות הפרטיות לפני הפעלה מלאה של ההתאמות.
      </p>

      <div className="mt-8">
        <ProfileStepOneForm
          onSave={updateProfileSettingsAction}
          submitLabel="שמירת שינויים"
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
          initial={{
            professionalFieldId: profile.professionalFieldId ?? "",
            targetRoleIds: profile.targetRoles.map((r) => r.targetRoleId),
            currentRoleTitle: profile.currentRoleTitle ?? "",
            regionId: profile.regionId,
            shortIntro: profile.shortIntro ?? "",
            tagIds: profile.tags.map((t) => t.tagId),
            languageIds: profile.languages.map((l) => l.languageId),
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
          }}
        />
      </div>
    </Container>
  );
}
