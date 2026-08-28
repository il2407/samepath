import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { CompanyMergeForm } from "@/modules/admin/CompanyMergeForm";

export const metadata: Metadata = { title: "חברות — SamePath Admin" };

const statusLabels: Record<string, string> = {
  CONFIRMED: "מאושר",
  NEEDS_REVIEW: "דורש בדיקה",
  MERGED: "מוזג",
};

export default async function AdminCompaniesPage() {
  await requireAdmin();
  const companies = await prisma.company.findMany({
    where: { mergedIntoId: null },
    include: { _count: { select: { aliases: true, employmentPositions: true } }, corporateGroup: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const needsReview = companies.filter((c) => c.normalizationStatus === "NEEDS_REVIEW");

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">חברות</h1>

      <div className="mt-6">
        <CompanyMergeForm />
      </div>

      {needsReview.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted">דורשות בדיקה ({needsReview.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {needsReview.map((c) => (
              <li key={c.id} className="rounded-lg bg-warm-surface px-3 py-2 text-ink">
                {c.canonicalName}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold text-muted">כל החברות ({companies.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-paper text-right text-xs text-muted">
            <tr>
              <th className="p-3">שם</th>
              <th className="p-3">קבוצת חברות</th>
              <th className="p-3">כינויים</th>
              <th className="p-3">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 text-ink">{c.canonicalName}</td>
                <td className="p-3 text-muted">{c.corporateGroup?.name ?? "—"}</td>
                <td className="p-3 text-muted">{c._count.aliases}</td>
                <td className="p-3 text-muted">{statusLabels[c.normalizationStatus] ?? c.normalizationStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
