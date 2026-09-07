import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getPublishedGuide } from "@/modules/guides/service";
import { Container } from "@/shared/ui/Container";
import { connectionFormatLabels } from "@/modules/profiles/labels";

const stepKindLabels: Record<string, string> = {
  AGENDA: "סדר יום",
  PROMPT: "שאלה מנחה",
  FOLLOWUP: "המשך אפשרי",
};

export default async function GuideDetailPage({ params, searchParams }: PageProps<"/app/guides/[id]">) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const guide = await getPublishedGuide(id);
  if (!guide) notFound();

  const format = typeof query?.format === "string" ? query.format : undefined;
  const category = typeof query?.category === "string" ? query.category : undefined;
  const backHref =
    format && category
      ? `/app/guides?format=${format}&category=${encodeURIComponent(category)}`
      : "/app/guides";

  return (
    <Container className="max-w-2xl py-10">
      <Link href={backHref} className="text-sm text-muted hover:text-ink">
        ‹ חזרה למערכי המפגש
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-ink">{guide.title}</h1>
      <p className="mt-2 text-muted">{guide.purpose}</p>
      <p className="mt-2 text-sm text-muted">
        {connectionFormatLabels[guide.format]} · כ-{guide.suggestedDurationMinutes} דקות
      </p>

      <ol className="mt-8 space-y-4">
        {guide.steps.map((step, index) => (
          <li key={step.id} className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-mint text-xs font-semibold text-primary-dark">
                {index + 1}
              </span>
              <span className="text-xs text-muted">{stepKindLabels[step.kind] ?? step.kind}</span>
            </div>
            <p className="mt-2 font-medium text-ink">{step.title}</p>
            <p className="mt-1 text-sm text-muted">{step.prompt}</p>
          </li>
        ))}
      </ol>
    </Container>
  );
}
