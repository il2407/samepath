import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { getAccessStatus } from "@/modules/access-passes/service";
import { listMyPayments } from "@/modules/payments/service";
import { prisma } from "@/shared/db";
import { PurchaseButton } from "@/modules/payments/PurchaseButton";
import { Container } from "@/shared/ui/Container";
import { PRICING_ENABLED } from "@/shared/features";
import { FlowNav } from "../FlowNav";

export const metadata: Metadata = { title: "התוכנית שלי — SamePath" };

const paymentStatusLabels: Record<string, string> = {
  CREATED: "נוצר",
  PENDING: "בתהליך",
  PAID: "שולם",
  FAILED: "נכשל",
  REFUNDED: "זוכה",
  CANCELLED: "בוטל",
};

const paymentStatusStyles: Record<string, string> = {
  CREATED: "bg-warm-surface text-muted",
  PENDING: "bg-sand text-calm-dark",
  PAID: "bg-mint text-primary-dark",
  FAILED: "bg-danger/10 text-danger",
  REFUNDED: "bg-warm-surface text-muted",
  CANCELLED: "bg-danger/10 text-danger",
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 12.3 11 14.8l4.5-5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <rect x="6" y="10.5" width="12" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default async function AccessPage() {
  const user = await requireUser();
  const [status, payments, products] = await Promise.all([
    getAccessStatus(user.id),
    PRICING_ENABLED ? listMyPayments(user.id) : Promise.resolve([]),
    PRICING_ENABLED ? prisma.productConfiguration.findMany({ where: { isActive: true } }) : Promise.resolve([]),
  ]);

  return (
    <Container className="max-w-2xl py-10">
      <FlowNav />
      <h1 className="text-2xl font-bold text-ink">התוכנית שלי</h1>
      <p className="mt-2 text-muted">
        גישה לתקופה קצובה, בלי חידוש אוטומטי. יצירת פרופיל ובדיקת התאמות רלוונטיות תמיד ללא עלות —
        גישה נדרשת רק כדי להשלים חיבור הדדי או להצטרף לקבוצה.
      </p>

      <div className="mt-6 flex items-start gap-4 rounded-2xl border border-border bg-white p-6">
        <span
          aria-hidden
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            status.hasActivePass
              ? "bg-mint text-primary-dark"
              : status.pendingPass
                ? "bg-sand text-calm-dark"
                : "bg-warm-surface text-muted"
          }`}
        >
          {status.hasActivePass ? <CheckIcon /> : status.pendingPass ? <ClockIcon /> : <LockIcon />}
        </span>
        <div className="min-w-0 flex-1">
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
              <p className="text-sm text-muted">הגישה שלכם מוכנה — היא תופעל אוטומטית</p>
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
      </div>

      {PRICING_ENABLED && !status.hasActivePass && !status.pendingPass && (
        <section className="mt-6 space-y-3">
          <h2 className="font-semibold text-ink">הפעלת גישה</h2>
          {products.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-5">
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

      {PRICING_ENABLED && (
        <section className="mt-8">
          <h2 className="font-semibold text-ink">היסטוריית תשלומים</h2>
          <div className="mt-3 space-y-2">
            {payments.length === 0 ? (
              <p className="text-sm text-muted">אין עדיין תשלומים.</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm">
                  <span className="text-ink">{p.productConfig.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      paymentStatusStyles[p.status] ?? "bg-warm-surface text-muted"
                    }`}
                  >
                    {paymentStatusLabels[p.status] ?? p.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </Container>
  );
}
