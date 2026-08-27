import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { Container } from "@/shared/ui/Container";
import { cn } from "@/shared/ui/cn";

const steps = [
  { key: "profile", label: "פרופיל מקצועי" },
  { key: "privacy", label: "פרטיות" },
  { key: "preferences", label: "העדפות חיבור" },
] as const;

export default async function OnboardingLayout({ children }: LayoutProps<"/app/onboarding">) {
  const user = await requireUser();
  const currentStep = await getOnboardingStep(user.id);
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <Container className="max-w-2xl py-10">
      <ol className="mb-8 flex items-center gap-2 text-sm">
        {steps.map((step, index) => (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                index < currentIndex || currentStep === "done"
                  ? "bg-primary text-white"
                  : index === currentIndex
                    ? "bg-mint text-primary-dark ring-2 ring-primary"
                    : "bg-warm-surface text-muted",
              )}
            >
              {index + 1}
            </span>
            <span className={index === currentIndex ? "font-medium text-ink" : "text-muted"}>{step.label}</span>
            {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
          </li>
        ))}
      </ol>
      {children}
    </Container>
  );
}
