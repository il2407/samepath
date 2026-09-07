import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { getAccessStatus } from "@/modules/access-passes/service";
import { listMyPayments } from "@/modules/payments/service";
import { prisma } from "@/shared/db";
import { PurchaseButton } from "@/modules/payments/PurchaseButton";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "התוכנית שלי — SamePath" };

const paymentStatusLabels: Record<string, string> = {
  CREATED: "נוצר",
  PENDING: "בתהליך",
  PAID: "שולם",
  FAILED: "נכשל",
  REFUNDED: "זוכה",
  CANCELLED: "בוטל",
};

export default async function AccessPage() {
  const user = await requireUser();
  const [status, payments, products] = await Promise.all([
    getAccessStatus(user.id),
    listMyPayments(user.id),
    prisma.productConfiguration.findMany({ where: { isActive: true } }),
  ]);

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">התוכנית שלי</h1>
      <p className="mt-2 text-muted">
        גישה לתקופה קצובה, בלי חידוש אוטומטי. יצירת פרופיל ובדיקת התאמות רלוונטיות תמיד ללא עלות —
        גישה נדרשת רק כדי להשלים חיבור הדדי או להצטרף לקבוצה.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-white p-6">
        {status.hasActivePass ? (
          <>
            <p className="text-sm text-muted">הגישה שלכם פעילה</p>
            <p className="mt-1 text-2xl font-bold text-primary-dark">
              {status.daysRemaining !== null && status.daysRemaining > 0 ? `${status.daysRemaining} ימים נותרו` : "פגה בקרוב"}
            </p>
            {status.expiresAt && (
              <p className="mt-1 text-sm text-muted">תפוג בתאריך {status.expiresAt.toLocaleDateString("he-IL")}</p>
            )}
          </>
        ) : status.pendingPass ? (
          <>
            <p className="text-sm text-muted">שילמתם על גישה — היא תופעל אוטומטית</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              ברגע שתתקבל התאמה הדדית ראשונה או שתצטרפו לקבוצה ראשונה
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">אין לכם כרגע גישה פעילה</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              הצעות התאמה עדיין יופיעו — גישה נדרשת רק כדי להשלים חיבור הדדי או להצטרף לקבוצה
            </p>
          </>
        )}
      </div>

      {!status.hasActivePass && !status.pendingPass && (
        <section className="mt-6 space-y-3">
          <h2 className="font-semibold text-ink">הפעלת גישה</h2>
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-white p-5">
              <div>
                <p className="font-medium text-ink">{p.name}</p>
                <p className="text-sm text-muted">
                  {(p.priceCents / 100).toLocaleString("he-IL")} {p.currency} · {p.accessDurationDays} יום מרגע ההפעלה
                </p>
              </div>
              <PurchaseButton productKey={p.key} label="רכישה" />
            </div>
          ))}
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold text-ink">היסטוריית תשלומים</h2>
        <div className="mt-3 space-y-2">
          {payments.length === 0 ? (
            <p className="text-sm text-muted">אין עדיין תשלומים.</p>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-sm">
                <span className="text-ink">{p.productConfig.name}</span>
                <span className="text-muted">{paymentStatusLabels[p.status] ?? p.status}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </Container>
  );
}
