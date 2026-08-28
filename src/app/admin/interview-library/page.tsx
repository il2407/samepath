import type { Metadata } from "next";
import { requireModerator } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { LibraryAdminRowActions } from "@/modules/admin/LibraryAdminRow";

export const metadata: Metadata = { title: "ספריית ראיונות — SamePath Admin" };

const statusLabels: Record<string, string> = {
  SCHEDULED_FOR_PUBLICATION: "ממתין לפרסום",
  PUBLISHED: "פורסם",
  REMOVED: "הוסר",
};

export default async function AdminInterviewLibraryPage() {
  await requireModerator();

  const experiences = await prisma.interviewExperience.findMany({
    where: { status: { in: ["SCHEDULED_FOR_PUBLICATION", "PUBLISHED", "REMOVED"] } },
    include: { company: { select: { canonicalName: true } }, questions: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">ספריית ראיונות</h1>
      <p className="mt-1 text-sm text-muted">תוכן שפורסם או מתוזמן לפרסום. בקשות ממתינות לבדיקה נמצאות תחת מודרציית תרומות.</p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-paper text-right text-xs text-muted">
            <tr>
              <th className="p-3">חברה</th>
              <th className="p-3">תקופה</th>
              <th className="p-3">שאלות</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3">נוצר</th>
              <th className="p-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {experiences.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3 text-ink">{e.company.canonicalName}</td>
                <td className="p-3 text-muted">
                  {e.periodYear} רבעון {e.periodQuarter}
                </td>
                <td className="p-3 text-muted">{e.questions.length}</td>
                <td className="p-3 text-muted">{statusLabels[e.status] ?? e.status}</td>
                <td className="p-3 text-muted">{e.createdAt.toLocaleDateString("he-IL")}</td>
                <td className="p-3">
                  <LibraryAdminRowActions experienceId={e.id} status={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
