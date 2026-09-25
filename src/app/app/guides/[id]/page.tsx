import { ContentProposal } from "@/modules/connections/ContentProposal";
import styles from "../../platform.module.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getPublishedGuide } from "@/modules/guides/service";
import { getLessonTemplate } from "@/modules/guides/catalog";
import { Container } from "@/shared/ui/Container";
import { connectionFormatLabels } from "@/modules/profiles/labels";
import { FlowNav } from "../../FlowNav";

const stepKindLabels: Record<string, string> = {
  AGENDA: "סדר יום",
  PROMPT: "שאלה מנחה",
  FOLLOWUP: "המשך אפשרי",
};

const stepRoleLabels: Record<string, string> = {
  PRESENTER: "התפקיד שלך: פעיל/ה (מציג/ה, פותר/ת, עונה)",
  LISTENER: "התפקיד שלך: מקשיב/ה ושואל/ת",
  BOTH: "התפקיד שלך: שניכם יחד",
};

export default async function GuideDetailPage({ params, searchParams }: PageProps<"/app/guides/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const connectionId = typeof query.connection === "string" ? query.connection : undefined;
  const guide = await getPublishedGuide(id);
  if (!guide) notFound();
  const template = getLessonTemplate(guide.category ?? undefined);

  const format = typeof query?.format === "string" ? query.format : undefined;
  const category = typeof query?.category === "string" ? query.category : undefined;
  const backHref =
    format && category
      ? `/app/guides?format=${format}&category=${encodeURIComponent(category)}`
      : "/app/guides";

  return (
    <Container className="max-w-2xl py-10">
      <FlowNav prev={{ href: connectionId ? `/app/guides?connection=${encodeURIComponent(connectionId)}` : backHref, label: "חזרה למאגר התוכן" }} />
      <h1 className="mt-3 text-2xl font-bold text-ink">{guide.title}</h1>
      <p className="mt-2 text-muted">{guide.purpose}</p>
      <p className="mt-2 text-sm text-muted">
        {connectionFormatLabels[guide.format]} · כ-{guide.suggestedDurationMinutes} דקות
      </p>
      <ContentProposal userId={user.id} contentKey={`guide:${guide.id}`} connectionId={connectionId} />
      {template && (
        <Link href={`/app/guides?category=${template.slug}${connectionId ? `&connection=${encodeURIComponent(connectionId)}` : ""}`} className="mt-6 block rounded-xl border border-border bg-mint p-4 text-sm text-primary-dark hover:underline">
          למערך {template.title} המעודכן — מבנה קבוע, שאלות לבחירה וכלים למראיין/ת ←
        </Link>
      )}

      <ol className={`mt-8 ${styles.guideSteps}`}>
        {guide.steps.map((step, index) => (
          <li key={step.id} className="rounded-2xl border border-border bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-mint text-xs font-semibold text-primary-dark">
                {index + 1}
              </span>
              <span className="text-xs text-muted">{stepKindLabels[step.kind] ?? step.kind}</span>
              {step.durationMinutes != null && step.durationMinutes > 0 && (
                <span className="text-xs text-muted">· {step.durationMinutes} דקות</span>
              )}
            </div>
            <p className="mt-2 font-medium text-ink">{step.title}</p>
            {step.role !== "BOTH" && (
              <p className="mt-1 text-xs font-medium text-primary-dark">{stepRoleLabels[step.role] ?? step.role}</p>
            )}
            <p className="mt-1 text-sm text-muted">{step.prompt}</p>
          </li>
        ))}
      </ol>
    </Container>
  );
}
