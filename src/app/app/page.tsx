import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { Container } from "@/shared/ui/Container";

const stepPaths = {
  profile: "/app/onboarding/profile",
  privacy: "/app/onboarding/privacy",
  preferences: "/app/onboarding/preferences",
} as const;

export default async function AppHomePage() {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  if (step !== "done") redirect(stepPaths[step]);

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold text-ink">ברוכים הבאים ל-SamePath</h1>
      <p className="mt-2 text-muted">
        הפרופיל שלכם ({user.email}) פעיל. הצעות התאמה, חיבורים וקבוצות יופיעו כאן בקרוב.
      </p>
    </Container>
  );
}
