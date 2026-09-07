import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import {
  GUIDE_CATEGORY_LABELS,
  GUIDE_SESSION_FORMATS,
  listPublishedGuides,
  type GuideSessionFormat,
} from "@/modules/guides/service";
import { Container } from "@/shared/ui/Container";
import { connectionFormatLabels } from "@/modules/profiles/labels";

export const metadata: Metadata = { title: "מערכי מפגש — SamePath" };

function isSessionFormat(value: string | undefined): value is GuideSessionFormat {
  return GUIDE_SESSION_FORMATS.some((f) => f.value === value);
}

export default async function GuidesPage({ searchParams }: PageProps<"/app/guides">) {
  await requireUser();
  const params = await searchParams;
  const formatParam = typeof params?.format === "string" ? params.format : undefined;
  const category = typeof params?.category === "string" ? params.category : undefined;
  const format = isSessionFormat(formatParam) ? formatParam : undefined;

  const allGuides = await listPublishedGuides();

  const intro = <h1 className="text-2xl font-bold text-ink">מערכי מפגש</h1>;

  // Level 1: choose the session format (1:1 vs group).
  if (!format) {
    return (
      <Container className="max-w-2xl py-10">
        {intro}
        <p className="mt-2 text-muted">
          עזרה קלה לשיחה — לא חובה להשתמש בה, ואין צורך לדווח על סיום.
          <br />
          בחרו את סוג המפגש כדי לראות את מערכי המפגש המתאימים לו.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {GUIDE_SESSION_FORMATS.map((f) => {
            const count = allGuides.filter((g) => g.format === f.value || g.format === "BOTH").length;
            return (
              <Link
                key={f.value}
                href={`/app/guides?format=${f.value}`}
                className="block rounded-2xl border border-border bg-white p-5 hover:border-primary"
              >
                <p className="font-semibold text-ink">{f.title}</p>
                <p className="mt-1 text-sm text-muted">{f.description}</p>
                <p className="mt-2 text-xs text-muted">{count} מערכים</p>
              </Link>
            );
          })}
        </div>
      </Container>
    );
  }

  const formatMeta = GUIDE_SESSION_FORMATS.find((f) => f.value === format)!;
  const guidesForFormat = allGuides.filter((g) => g.format === format || g.format === "BOTH");

  // Level 2: choose the kind of session (system design, coding, project pitch, ...).
  if (!category) {
    const categories: { key: string; label: string; count: number }[] = [];
    for (const g of guidesForFormat) {
      const key = g.category ?? "כללי";
      const existing = categories.find((c) => c.key === key);
      if (existing) existing.count += 1;
      else categories.push({ key, label: GUIDE_CATEGORY_LABELS[key] ?? key, count: 1 });
    }

    return (
      <Container className="max-w-2xl py-10">
        <Link href="/app/guides" className="text-sm text-muted hover:text-ink">
          ‹ מערכי מפגש
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-ink">{formatMeta.title}</h1>
        <p className="mt-2 text-muted">בחרו את סוג התוכן שהייתם רוצים למסגרת השיחה.</p>

        <div className="mt-8 space-y-3">
          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
              אין כרגע מערכי מפגש זמינים בפורמט הזה.
            </div>
          ) : (
            categories.map((c) => (
              <Link
                key={c.key}
                href={`/app/guides?format=${format}&category=${encodeURIComponent(c.key)}`}
                className="block rounded-2xl border border-border bg-white p-5 hover:border-primary"
              >
                <p className="font-semibold text-ink">{c.label}</p>
                <p className="mt-1 text-xs text-muted">{c.count} מערכים</p>
              </Link>
            ))
          )}
        </div>
      </Container>
    );
  }

  // Level 3: the guides within that kind of session.
  const guidesInCategory = guidesForFormat.filter((g) => (g.category ?? "כללי") === category);
  const categoryLabel = GUIDE_CATEGORY_LABELS[category] ?? category;

  return (
    <Container className="max-w-2xl py-10">
      <Link href={`/app/guides?format=${format}`} className="text-sm text-muted hover:text-ink">
        ‹ {formatMeta.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-ink">{categoryLabel}</h1>

      <div className="mt-8 space-y-3">
        {guidesInCategory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            אין כרגע מערכי מפגש זמינים.
          </div>
        ) : (
          guidesInCategory.map((g) => (
            <Link
              key={g.id}
              href={`/app/guides/${g.id}?format=${format}&category=${encodeURIComponent(category)}`}
              className="block rounded-2xl border border-border bg-white p-5 hover:border-primary"
            >
              <p className="font-semibold text-ink">{g.title}</p>
              <p className="mt-1 text-sm text-muted">{g.purpose}</p>
              <p className="mt-2 text-xs text-muted">
                {connectionFormatLabels[g.format]} · כ-{g.suggestedDurationMinutes} דקות
              </p>
            </Link>
          ))
        )}
      </div>
    </Container>
  );
}
