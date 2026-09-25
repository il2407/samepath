import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { LinkButton } from "@/shared/ui/Button";

export const metadata: Metadata = { title: "בואו נתחיל — SamePath" };

const steps = [
  {
    title: "מעלים קורות חיים",
    description: "אנחנו שולפים מהם את התפקיד, החברה והתחומים שלכם אוטומטית — בלי טפסים ארוכים.",
  },
  {
    title: "קובעים הגדרות פרטיות",
    description: "אתם בוחרים מה יוצג ולמי, כולל חברות שלא יראו את הפרופיל שלכם.",
  },
  {
    title: "מגדירים העדפות חיבור",
    description: "עם מי תרצו להתחבר — תחום, ותק, ומה שחשוב לכם בהתאמה.",
  },
] as const;

/**
 * The first screen a brand-new account sees, right after the email OTP
 * (auth/service.ts#getPostAuthRedirectPath sends profile-less users here).
 * It only explains the flow — anyone already past step 1 is bounced back
 * to wherever onboarding actually stands.
 */
export default async function OnboardingWelcomePage() {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  if (step === "done") redirect("/app");
  if (step !== "profile") redirect(`/app/onboarding/${step}`);

  return (
    <div className="rounded-3xl border border-border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-ink">3 שלבים ומתחילים לקבל התאמות</h1>
      <p className="mt-2 text-sm text-muted">יצירת הפרופיל ובדיקת התאמות רלוונטיות הן ללא עלות.</p>

      <ol className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {index + 1}
            </span>
            <div>
              <p className="font-semibold text-ink">{step.title}</p>
              <p className="text-sm text-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-sm text-muted">אחרי זה — מתחילים לקבל התאמות מותאמות אישית.</p>

      <LinkButton href="/app/onboarding/profile" className="mt-6 w-full">
        בואו נתחיל
      </LinkButton>
    </div>
  );
}
