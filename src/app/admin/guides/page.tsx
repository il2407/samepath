import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { CreateGuideForm } from "@/modules/admin/CreateGuideForm";
import { GuideStatusActions } from "@/modules/admin/GuideStatusActions";

export const metadata: Metadata = { title: "מדריכי שיחה — SamePath Admin" };

const statusLabels: Record<string, string> = {
  DRAFT: "טיוטה",
  PUBLISHED: "פורסם",
  ARCHIVED: "בארכיון",
};

const formatLabels: Record<string, string> = {
  ONE_ON_ONE: "אחד על אחד",
  GROUP: "קבוצה",
  BOTH: "שניהם",
};

export default async function AdminGuidesPage() {
  await requireAdmin();
  const guides = await prisma.sessionGuide.findMany({
    include: { _count: { select: { steps: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">מדריכי שיחה</h1>

      <div className="mt-6">
        <CreateGuideForm />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted">כל המדריכים ({guides.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-paper text-right text-xs text-muted">
            <tr>
              <th className="p-3">כותרת</th>
              <th className="p-3">פורמט</th>
              <th className="p-3">שלבים</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {guides.map((g) => (
              <tr key={g.id} className="border-t border-border">
                <td className="p-3 text-ink">{g.title}</td>
                <td className="p-3 text-muted">{formatLabels[g.format] ?? g.format}</td>
                <td className="p-3 text-muted">{g._count.steps}</td>
                <td className="p-3 text-muted">{statusLabels[g.status] ?? g.status}</td>
                <td className="p-3">
                  <GuideStatusActions guideId={g.id} status={g.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
