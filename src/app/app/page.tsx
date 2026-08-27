import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { getActiveSuggestionsForUser } from "@/modules/matching/service";
import { listConnectionsForUser } from "@/modules/connections/service";
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

  const [suggestions, connections] = await Promise.all([
    getActiveSuggestionsForUser(user.id),
    listConnectionsForUser(user.id),
  ]);
  const activeConnections = connections.filter((c) => c.status === "ACTIVE");

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold text-ink">ברוכים הבאים ל-SamePath</h1>
      <p className="mt-2 text-muted">הפרופיל שלכם ({user.email}) פעיל.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/app/matches" className="rounded-2xl border border-border bg-white p-6 hover:border-primary">
          <p className="text-3xl font-bold text-ink">{suggestions.length}</p>
          <p className="mt-1 text-sm text-muted">הצעות התאמה ממתינות</p>
        </Link>
        <Link href="/app/connections" className="rounded-2xl border border-border bg-white p-6 hover:border-primary">
          <p className="text-3xl font-bold text-ink">{activeConnections.length}</p>
          <p className="mt-1 text-sm text-muted">חיבורים פעילים</p>
        </Link>
      </div>
    </Container>
  );
}
