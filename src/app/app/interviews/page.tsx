import { EditorialPhoto } from "@/shared/ui/EditorialPhoto";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { browseExperiences } from "@/modules/interviews/library";
import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { FlowNav } from "../FlowNav";

export const metadata: Metadata = { title: "שאלות אמיתיות מראיונות — SamePath" };

const avatarPalette = ["bg-mint text-primary-dark", "bg-sand text-calm-dark", "bg-happy/40 text-happy-dark"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}

export default async function InterviewLibraryPage({ searchParams }: PageProps<"/app/interviews">) {
  const query = await searchParams;
  const connectionId = typeof query.connection === "string" ? query.connection : undefined;
  const suffix = connectionId ? `?connection=${encodeURIComponent(connectionId)}` : "";
  await requireUser();
  const experiences = await browseExperiences({}, 30);

  return (
    <Container className="max-w-2xl py-10">
      <EditorialPhoto scene="notebook" label="הידע של הקהילה" caption="להגיע לראיון עם קצת יותר כיוון." />
      <FlowNav prev={{ href: `/app/guides${suffix}`, label: "חזרה למאגר התוכן" }} />
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">שאלות אמיתיות מראיונות</h1>
        <LinkButton href="/app/contributions/new" className="shrink-0 px-4 py-2 text-sm">
          שיתוף חוויית ראיון
        </LinkButton>
      </div>

      <p className="mt-4 rounded-xl border border-primary/30 bg-mint px-4 py-3 text-sm font-medium text-primary-dark">
        שיתוף חוויה משלכם (לאחר אישור צוות המודרציה) מזכה בקרדיטים —{" "}
        <Link href="/app/contributions" className="underline hover:text-primary">
          לצפייה בתרומות שלי
        </Link>
        {" · "}
        <Link href="/app/credits" className="underline hover:text-primary">
          יתרת הקרדיטים שלי
        </Link>
      </p>

      <p className="mt-3 text-xs text-muted">
        תוכן שנתרם על ידי חברי הקהילה.
        <br />
        המידע עשוי להיות חלקי או לא מעודכן, ואינו מאומת על ידי החברות המוזכרות ואינו מבטיח את תהליך
        הראיון הנוכחי שלהן.
      </p>

      <div className="mt-8 space-y-3">
        {experiences.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            אין עדיין תרומות מפורסמות.
          </div>
        ) : (
          experiences.map((e, i) => (
            <Link
              key={e.id}
              href={`/app/interviews/experiences/${e.id}${suffix}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5 transition-colors hover:border-primary"
            >
              <span
                aria-hidden
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarPalette[i % avatarPalette.length]}`}
              >
                {initialsOf(e.companyName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold text-ink">{e.companyName}</p>
                  <span className="shrink-0 text-xs text-muted">
                    {e.periodYear} · רבעון {e.periodQuarter}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {e.targetRole ? (
                    <span className="rounded-full bg-warm-surface px-2.5 py-1 text-xs text-muted">{e.targetRole}</span>
                  ) : null}
                  {e.seniorityBand ? (
                    <span className="rounded-full bg-warm-surface px-2.5 py-1 text-xs text-muted">{e.seniorityBand}</span>
                  ) : null}
                  <span className="text-xs text-muted">{e.questionCount} שאלות</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Container>
  );
}
