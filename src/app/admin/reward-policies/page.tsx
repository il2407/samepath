import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { RewardPolicyEditor } from "@/modules/admin/RewardPolicyEditor";

export const metadata: Metadata = { title: "מדיניות תגמול — SamePath Admin" };

export default async function AdminRewardPoliciesPage() {
  await requireAdmin();
  const policies = await prisma.rewardPolicy.findMany({ orderBy: { key: "asc" } });

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">מדיניות תגמול</h1>
      <p className="mt-1 text-sm text-muted">עריכת פרמטרים כ-JSON גולמי. שינוי משפיע מיידית על חישובי קרדיט חדשים.</p>
      <div className="mt-6 space-y-4">
        {policies.map((p) => (
          <RewardPolicyEditor key={p.key} policyKey={p.key} description={p.description} valueJson={p.valueJson} />
        ))}
      </div>
    </div>
  );
}
