import type { Metadata } from "next";
import { requireUser } from "@/modules/auth/session";
import { getCreditBalance, listLedger, loadRewardPolicy } from "@/modules/credits/service";
import { CreditConversionPanel } from "@/modules/credits/CreditConversionPanel";
import { Container } from "@/shared/ui/Container";
import { FlowNav } from "../FlowNav";

export const metadata: Metadata = { title: "קרדיטים — SamePath" };

const reasonLabels: Record<string, string> = {
  CONTRIBUTION_APPROVED: "תרומה אושרה",
  UNIQUE_QUESTION_BONUS: "בונוס שאלה ייחודית",
  VALIDATION_BONUS: "בונוס אימות קהילתי",
  CONVERSION: "המרה לימי גישה",
  REVERSAL: "ביטול הענקה",
  ADMIN_ADJUSTMENT: "התאמה על ידי צוות",
};

export default async function CreditsPage() {
  const user = await requireUser();
  const [balance, ledger, policy] = await Promise.all([
    getCreditBalance(user.id),
    listLedger(user.id),
    loadRewardPolicy(),
  ]);

  return (
    <Container className="max-w-2xl py-10">
      <FlowNav />
      <h1 className="text-2xl font-bold text-ink">קרדיטים</h1>
      <p className="mt-2 text-muted">
        קרדיטים אינם ניתנים למימוש כספי או להעברה. הם מוענקים רק לאחר אישור תרומה על ידי צוות המודרציה.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-mint p-6">
        <p className="text-sm text-primary-dark">היתרה שלכם</p>
        <p className="mt-1 text-4xl font-bold text-primary-dark">{balance}</p>
      </div>

      <section className="mt-6">
        <h2 className="font-semibold text-ink">המרה לימי גישה נוספים</h2>
        <CreditConversionPanel tiers={policy.conversionTiers} />
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-ink">היסטוריה</h2>
        <div className="mt-3 space-y-2">
          {ledger.length === 0 ? (
            <p className="text-sm text-muted">אין עדיין פעילות.</p>
          ) : (
            ledger.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm">
                <span className="text-ink">{reasonLabels[entry.reason] ?? entry.reason}</span>
                <span className={entry.amount >= 0 ? "font-medium text-primary-dark" : "font-medium text-muted"}>
                  {entry.amount >= 0 ? "+" : ""}
                  {entry.amount}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </Container>
  );
}
