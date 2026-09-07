import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { browseExperiences } from "@/modules/interviews/library";
import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "שאלות אמיתיות מראיונות — SamePath" };

export default async function InterviewLibraryPage() {
  await requireUser();
  const experiences = await browseExperiences({}, 30);

  return (
    <Container className="max-w-2xl py-10">
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
          experiences.map((e) => (
            <Link
              key={e.id}
              href={`/app/interviews/experiences/${e.id}`}
              className="block rounded-2xl border border-border bg-white p-5 hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">{e.companyName}</p>
                <span className="text-xs text-muted">
                  {e.periodYear} · רבעון {e.periodQuarter}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {[e.targetRole, e.seniorityBand].filter(Boolean).join(" · ")} · {e.questionCount} שאלות
              </p>
            </Link>
          ))
        )}
      </div>
    </Container>
  );
}
