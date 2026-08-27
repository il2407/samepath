import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { getCompanyLibrarySummary, browseExperiences } from "@/modules/interviews/library";
import { interviewStageLabels } from "@/modules/interviews/labels";
import { Container } from "@/shared/ui/Container";

export default async function CompanyLibraryPage({ params }: PageProps<"/app/interviews/companies/[companyId]">) {
  await requireUser();
  const { companyId } = await params;
  const summary = await getCompanyLibrarySummary(companyId);
  if (!summary) notFound();

  const experiences = await browseExperiences({ companyId }, 30);

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">{summary.companyName}</h1>
      <p className="mt-1 text-sm text-muted">
        {summary.totalReports} דיווחים קהילתיים
        {summary.latestReportDate && ` · העדכני ביותר: ${summary.latestReportDate.toLocaleDateString("he-IL")}`}
      </p>
      <p className="mt-2 text-xs text-muted">מידע קהילתי, לא מאומת על ידי החברה ואינו מבטיח את התהליך הנוכחי.</p>

      {summary.canShowAggregateStats ? (
        <section className="mt-6 rounded-2xl border border-border bg-white p-6">
          <h2 className="font-semibold text-ink">שלבים נפוצים</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            {summary.commonStages.map((s) => (
              <span key={s} className="rounded-full bg-paper px-2.5 py-1">
                {interviewStageLabels[s] ?? s}
              </span>
            ))}
          </div>
          {summary.recurringTopics.length > 0 && (
            <>
              <h2 className="mt-4 font-semibold text-ink">נושאים חוזרים</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                {summary.recurringTopics.map((t) => (
                  <span key={t} className="rounded-full bg-mint px-2.5 py-1 text-primary-dark">
                    {t}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          עדיין אין מספיק דיווחים עצמאיים כדי להציג מגמות מצטברות עבור החברה הזו.
        </p>
      )}

      <section className="mt-4 space-y-3">
        <h2 className="font-semibold text-ink">דיווחים אחרונים</h2>
        {experiences.map((e) => (
          <Link
            key={e.id}
            href={`/app/interviews/experiences/${e.id}`}
            className="block rounded-2xl border border-border bg-white p-5 hover:border-primary"
          >
            <p className="text-sm text-ink">
              {[e.targetRole, e.seniorityBand].filter(Boolean).join(" · ")} · {e.periodYear} רבעון {e.periodQuarter}
            </p>
          </Link>
        ))}
      </section>
    </Container>
  );
}
