import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getPublicExperienceDetail } from "@/modules/interviews/library";
import { ExperienceDetailActions } from "@/modules/interviews/ExperienceDetailActions";
import { interviewOutcomeLabels, interviewStageLabels } from "@/modules/interviews/labels";
import { Container } from "@/shared/ui/Container";

export default async function ExperienceDetailPage({ params }: PageProps<"/app/interviews/experiences/[id]">) {
  await requireUser();
  const { id } = await params;
  const experience = await getPublicExperienceDetail(id);
  if (!experience) notFound();

  return (
    <Container className="max-w-2xl py-10">
      <p className="text-xs text-muted">מידע קהילתי, לא מאומת. עשוי להיות חלקי או לא מעודכן.</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">{experience.companyName}</h1>
      <p className="mt-1 text-sm text-muted">
        {[experience.targetRole, experience.seniorityBand, experience.region].filter(Boolean).join(" · ")} · {experience.periodYear}, רבעון {experience.periodQuarter}
      </p>

      {experience.stages.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          {experience.stages.map((s) => (
            <span key={s} className="rounded-full bg-paper px-2.5 py-1">
              {interviewStageLabels[s] ?? s}
            </span>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-white p-6">
        <h2 className="font-semibold text-ink">תהליך</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-ink/90">{experience.processDescription}</p>
        {experience.whatIWishIKnew && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-ink">מה הייתי רוצה לדעת מראש</h3>
            <p className="mt-1 text-sm text-ink/90">{experience.whatIWishIKnew}</p>
          </>
        )}
        {experience.outcome && (
          <p className="mt-4 text-sm text-muted">תוצאה: {interviewOutcomeLabels[experience.outcome] ?? experience.outcome}</p>
        )}
      </section>

      {experience.questions.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-white p-6">
          <h2 className="font-semibold text-ink">שאלות שדווחו (מנוסחות מחדש)</h2>
          <ul className="mt-3 space-y-3">
            {experience.questions.map((q) => (
              <li key={q.id} className="text-sm text-ink/90">
                {q.isFollowUp && <span className="ml-1 text-xs text-muted">↳ המשך:</span>}
                {q.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {experience.topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          {experience.topics.map((t) => (
            <span key={t} className="rounded-full bg-mint px-2.5 py-1 text-primary-dark">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6">
        <ExperienceDetailActions experienceId={experience.id} />
      </div>
    </Container>
  );
}
