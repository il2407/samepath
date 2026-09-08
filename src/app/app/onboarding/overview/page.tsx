import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep, getOnboardingOverviewData } from "@/modules/profiles/service";
import { confirmOnboardingAction } from "@/modules/profiles/actions";
import { Button } from "@/shared/ui/Button";
import {
  connectionCadenceLabels,
  connectionFormatLabels,
  connectionModeLabels,
  connectionReasonLabels,
  genderPreferenceLabels,
} from "@/modules/profiles/labels";

export const metadata: Metadata = { title: "סקירה ואישור — SamePath" };

const blockedCompanyReasonLabels: Record<string, string> = {
  FORMER_EMPLOYER: "מעסיק לשעבר",
  INTERVIEWING: "חברה שבה אני בתהליך ריאיון",
  CLIENT_OR_VENDOR: "לקוח או ספק",
  OTHER: "אחר",
};

const dayLabels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatMonthsAsYears(months: number): string {
  const years = months / 12;
  return Number.isInteger(years) ? String(years) : years.toFixed(1);
}

function EditLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm text-primary hover:text-primary-dark">
      עריכה
    </Link>
  );
}

export default async function OnboardingOverviewPage() {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);

  if (step === "profile") redirect("/app/onboarding/profile");
  if (step === "privacy") redirect("/app/onboarding/privacy");
  if (step === "preferences") redirect("/app/onboarding/preferences");
  if (step === "done") redirect("/app");

  const data = await getOnboardingOverviewData(user.id);
  if (!data) redirect("/app/onboarding/profile");
  const { profile, blockedCompanies } = data;

  const currentPosition = profile.employmentPositions.find((p) => p.isCurrent) ?? null;
  const previousPositions = profile.employmentPositions.filter((p) => !p.isCurrent);
  const cp = profile.connectionPreference;

  const availabilityByDay = new Map<number, string[]>();
  for (const slot of profile.availabilitySlots) {
    const list = availabilityByDay.get(slot.dayOfWeek) ?? [];
    const startHour = Math.floor(slot.startMinute / 60);
    const endHour = Math.floor(slot.endMinute / 60);
    list.push(`${startHour}:00–${endHour}:00`);
    availabilityByDay.set(slot.dayOfWeek, list);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">סקירה לפני הפעלה</h1>
      <p className="mt-2 text-muted">
        אלה כל הפרטים שמילאתם. אפשר לחזור ולתקן כל שלב לפני שההרשמה תושלם ותתחילו לראות הצעות התאמה.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">פרופיל מקצועי</h2>
            <EditLink href="/app/onboarding/profile?edit=true" />
          </div>
          <dl className="mt-4 space-y-2 text-sm text-ink">
            <div>
              <dt className="text-muted">תחום מקצועי</dt>
              <dd>{profile.professionalField?.labelHe ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">תפקידי יעד</dt>
              <dd>{profile.targetRoles.map((r) => r.targetRole.labelHe).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">תפקיד נוכחי</dt>
              <dd>{profile.currentRoleTitle ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">אזור</dt>
              <dd>{profile.region?.labelHe ?? "—"}</dd>
            </div>
            {profile.shortIntro && (
              <div>
                <dt className="text-muted">תיאור קצר</dt>
                <dd>{profile.shortIntro}</dd>
              </div>
            )}
            {profile.tags.length > 0 && (
              <div>
                <dt className="text-muted">תגיות</dt>
                <dd>{profile.tags.map((t) => t.tag.labelHe).join(", ")}</dd>
              </div>
            )}
            {profile.languages.length > 0 && (
              <div>
                <dt className="text-muted">שפות</dt>
                <dd>{profile.languages.map((l) => l.language.labelHe).join(", ")}</dd>
              </div>
            )}
            {currentPosition && (
              <div>
                <dt className="text-muted">מעסיק נוכחי</dt>
                <dd>
                  {currentPosition.company?.canonicalName ?? currentPosition.companyRaw} — {currentPosition.title}
                </dd>
              </div>
            )}
            {previousPositions.length > 0 && (
              <div>
                <dt className="text-muted">תפקידים קודמים</dt>
                <dd className="space-y-1">
                  {previousPositions.map((p) => (
                    <div key={p.id}>
                      {p.company?.canonicalName ?? p.companyRaw} — {p.title}
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">פרטיות</h2>
            <EditLink href="/app/onboarding/privacy?edit=true" />
          </div>
          <dl className="mt-4 space-y-2 text-sm text-ink">
            <div>
              <dt className="text-muted">מעסיק מאושר</dt>
              <dd>{profile.currentCompany?.canonicalName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">חברות חסומות</dt>
              <dd>
                {blockedCompanies.length === 0
                  ? "אין"
                  : blockedCompanies
                      .filter((b) => b.company)
                      .map((b) => `${b.company!.canonicalName} (${blockedCompanyReasonLabels[b.reason] ?? b.reason})`)
                      .join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">חשיפת שם החברה לפני אישור הדדי</dt>
              <dd>{profile.disclosurePreference?.shareCompanyPreMatch ? "כן" : "לא"}</dd>
            </div>
            <div>
              <dt className="text-muted">חשיפת שם פרטי מוקדם</dt>
              <dd>
                {profile.disclosurePreference?.shareFullNamePostMatch
                  ? `כן — ${profile.disclosurePreference.fullName ?? ""}`
                  : "לא"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">חשיפת תמונה לאחר אישור הדדי</dt>
              <dd>{profile.disclosurePreference?.sharePhotoPostMatch ? "כן" : "לא"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">העדפות חיבור</h2>
            <EditLink href="/app/onboarding/preferences?edit=true" />
          </div>
          <dl className="mt-4 space-y-2 text-sm text-ink">
            <div>
              <dt className="text-muted">טווח ניסיון של עמיתים מתאימים</dt>
              <dd>
                {cp
                  ? `${formatMonthsAsYears(cp.peerMinExperienceMonths)} עד ${formatMonthsAsYears(cp.peerMaxExperienceMonths)} שנים`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">סוג חיבור</dt>
              <dd>{cp ? connectionFormatLabels[cp.format] : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">תדירות</dt>
              <dd>{cp ? connectionCadenceLabels[cp.cadence] : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">אופן המפגש</dt>
              <dd>{cp ? connectionModeLabels[cp.mode] : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">מגדר עמיתים מתאימים</dt>
              <dd>{cp ? genderPreferenceLabels[cp.genderPreference] : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">שפת שיחה מועדפת</dt>
              <dd>{cp?.language?.labelHe ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">למה חשוב לכם להתחבר</dt>
              <dd>{cp?.reasons.map((r) => connectionReasonLabels[r] ?? r).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">זמינות שבועית</dt>
              <dd>
                {availabilityByDay.size === 0
                  ? "לא צוינה"
                  : Array.from(availabilityByDay.entries())
                      .sort(([a], [b]) => a - b)
                      .map(([day, ranges]) => `${dayLabels[day]}: ${ranges.join(", ")}`)
                      .join(" | ")}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <form action={confirmOnboardingAction} className="mt-8">
        <Button type="submit" className="w-full sm:w-auto">
          אישור והפעלת הפרופיל
        </Button>
      </form>
    </div>
  );
}
