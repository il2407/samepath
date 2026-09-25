import Link from "next/link";
import type { Metadata } from "next";
import { getMarketplaceHealthMetrics } from "@/modules/admin/metrics";

export const metadata: Metadata = { title: "לוח בקרה — SamePath Admin" };

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export default async function AdminDashboardPage() {
  const m = await getMarketplaceHealthMetrics();

  const tiles = [
    { label: "משתמשים פעילים", value: m.totalUsers },
    { label: "פרופילים פעילים", value: m.activeProfiles },
    { label: "הצעות התאמה (סה״כ)", value: m.totalSuggestions },
    { label: "אחוז אישור הדדי", value: pct(m.mutualAcceptanceRate) },
    { label: "חיבורים פעילים", value: m.activeConnections },
    { label: "אחוז מילוי קבוצות", value: pct(m.groupFillRate) },
    { label: "אחוז המרה לתשלום", value: pct(m.paidPassConversionRate) },
    { label: "אחוז דחיית פרטיות (מצטבר)", value: pct(m.privacyRejectionRate) },
  ];

  const alerts = [
    { label: "משתמשים ממתינים לאישור", value: m.pendingUserApprovals, href: "/admin/users?filter=PENDING" },
    { label: "שאלות ראיון ממתינות לאישור", value: m.pendingModerationCount, href: "/admin/contributions" },
    { label: "דיווחים פתוחים", value: m.openReportsCount, href: "/admin/reports" },
    { label: "בקשות הסרה פתוחות", value: m.openTakedownsCount, href: "/admin/takedowns" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">לוח בקרה</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-white p-5">
            <p className="text-2xl font-bold text-ink">{t.value}</p>
            <p className="mt-1 text-xs text-muted">{t.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted">דורש תשומת לב</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {alerts.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="rounded-2xl border border-border bg-white p-5 hover:border-primary"
          >
            <p className="text-2xl font-bold text-ink">{a.value}</p>
            <p className="mt-1 text-xs text-muted">{a.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
