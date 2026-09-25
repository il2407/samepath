import { EditorialPhoto } from "@/shared/ui/EditorialPhoto";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { Container } from "@/shared/ui/Container";
import { OnboardingSteps } from "./OnboardingSteps";

const stepKeys = ["profile", "privacy", "preferences", "overview"] as const;

export default async function OnboardingLayout({ children }: LayoutProps<"/app/onboarding">) {
  const user = await requireUser();
  const currentStep = await getOnboardingStep(user.id);
  // "done" means every step is complete — there's no matching entry in
  // stepKeys, so fall back to marking all four as filled.
  const completedIndex = currentStep === "done" ? stepKeys.length : stepKeys.indexOf(currentStep);

  return (
    <Container className="max-w-2xl py-10">
      <EditorialPhoto compact scene="conversation" label="נעים להכיר" caption="בואו נתחיל." />
      <OnboardingSteps completedIndex={completedIndex} />
      {children}
    </Container>
  );
}
