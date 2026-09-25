import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { CreateGroupForm } from "@/modules/admin/CreateGroupForm";
import { listProfessionalFields, listTargetRoles } from "@/modules/reference-data/service";

export const metadata: Metadata = { title: "קבוצות — SamePath Admin" };

const statusLabels: Record<string, string> = {
  DRAFT: "טיוטה",
  OPEN: "פתוחה",
  FULL: "מלאה",
  CLOSED: "סגורה",
  ARCHIVED: "בארכיון",
};

export default async function AdminGroupsPage() {
  await requireAdmin();
  const [groups, fields, targetRoles, guides] = await Promise.all([
    prisma.group.findMany({
      include: { memberships: { where: { status: { in: ["APPROVED", "ACTIVE"] } } }, waitlist: true },
      orderBy: { createdAt: "desc" },
    }),
    listProfessionalFields(),
    listTargetRoles(),
    prisma.sessionGuide.findMany({ where: { status: "PUBLISHED" } }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">קבוצות</h1>

      <div className="mt-6">
        <CreateGroupForm
          fields={fields.map((f) => ({ id: f.id, labelHe: f.labelHe }))}
          targetRoles={targetRoles.map((r) => ({ id: r.id, labelHe: r.labelHe }))}
          guides={guides.map((g) => ({ id: g.id, labelHe: g.title }))}
        />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted">כל הקבוצות ({groups.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-paper text-right text-xs text-muted">
            <tr>
              <th className="p-3">שם</th>
              <th className="p-3">חברים</th>
              <th className="p-3">רשימת המתנה</th>
              <th className="p-3">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-t border-border">
                <td className="p-3 text-ink">{g.title}</td>
                <td className="p-3 text-muted">
                  {g.memberships.length}/{g.capacityMax}
                </td>
                <td className="p-3 text-muted">{g.waitlist.length}</td>
                <td className="p-3 text-muted">{statusLabels[g.status] ?? g.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
