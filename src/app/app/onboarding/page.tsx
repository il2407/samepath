import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";

export default async function OnboardingPage() {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);

  if (step === "done") redirect("/app");
  redirect(`/app/onboarding/${step}`);
}
