import type { Metadata } from "next";
import { requireAdmin } from "@/modules/auth/session";
import { prisma } from "@/shared/db";
import { ProductConfigPanel } from "@/modules/admin/ProductConfigPanel";

export const metadata: Metadata = { title: "גישה ותשלומים — SamePath Admin" };

export default async function AdminAccessPage() {
  await requireAdmin();

  const [products, passStatusGroups, recentPayments] = await Promise.all([
    prisma.productConfiguration.findMany({ orderBy: { key: "asc" } }),
    prisma.accessPass.groupBy({ by: ["status"], _count: true }),
    prisma.payment.findMany({
      include: { user: { select: { email: true } }, productConfig: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">גישה ותשלומים</h1>

      <div className="mt-4 flex flex-wrap gap-3">
        {passStatusGroups.map((g) => (
          <div key={g.status} className="rounded-xl border border-border bg-white px-4 py-2 text-sm">
            <span className="text-muted">{g.status}: </span>
            <span className="font-semibold text-ink">{g._count}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted">מסלולי גישה</h2>
      <div className="mt-3">
        <ProductConfigPanel products={products} />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted">תשלומים אחרונים ({recentPayments.length})</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-paper text-right text-xs text-muted">
            <tr>
              <th className="p-3">משתמש</th>
              <th className="p-3">מוצר</th>
              <th className="p-3">סכום</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3">תאריך</th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3 text-ink">{p.user.email}</td>
                <td className="p-3 text-muted">{p.productConfig.name}</td>
                <td className="p-3 text-muted">
                  {(p.amountCents / 100).toFixed(2)} {p.currency}
                </td>
                <td className="p-3 text-muted">{p.status}</td>
                <td className="p-3 text-muted">{p.createdAt.toLocaleDateString("he-IL")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
