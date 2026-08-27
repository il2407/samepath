import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { listEligibleGroups } from "@/modules/groups/service";
import { GroupCard } from "@/modules/groups/GroupCard";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "קבוצות — SamePath" };

export default async function GroupsPage() {
  const user = await requireUser();
  if ((await getOnboardingStep(user.id)) !== "done") redirect("/app");

  const groups = await listEligibleGroups(user.id);

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">קבוצות</h1>
      <p className="mt-2 text-muted">קבוצות קטנות (כ-4–6 אנשים) שמתאימות לכם. חברי הקבוצה אינם מוצגים מראש.</p>

      <div className="mt-8 space-y-4">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            אין כרגע קבוצות זמינות עבורכם.
          </div>
        ) : (
          groups.map((g) => <GroupCard key={g.id} group={g} />)
        )}
      </div>
    </Container>
  );
}
