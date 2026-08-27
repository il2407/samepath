import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { listPublishedGuides } from "@/modules/guides/service";
import { Container } from "@/shared/ui/Container";
import { connectionFormatLabels } from "@/modules/profiles/labels";

export const metadata: Metadata = { title: "מדריכי מפגש — SamePath" };

export default async function GuidesPage() {
  await requireUser();
  const guides = await listPublishedGuides();

  return (
    <Container className="max-w-2xl py-10">
      <span className="rounded-full bg-lime/60 px-3 py-1 text-xs font-semibold text-primary-dark">
        תמיד אופציונלי
      </span>
      <h1 className="mt-3 text-2xl font-bold text-ink">מדריכי מפגש</h1>
      <p className="mt-2 text-muted">
        עזרה קלה לשיחה הראשונה — לא חובה להשתמש בהם, ואין צורך לדווח על סיום.
      </p>

      <div className="mt-8 space-y-3">
        {guides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            אין כרגע מדריכים זמינים.
          </div>
        ) : (
          guides.map((g) => (
            <Link
              key={g.id}
              href={`/app/guides/${g.id}`}
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
