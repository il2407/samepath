import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { browseExperiences } from "@/modules/interviews/library";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "ספריית חוויות ראיון — SamePath" };

export default async function InterviewLibraryPage() {
  await requireUser();
  const experiences = await browseExperiences({}, 30);

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-2xl font-bold text-ink">ספריית חוויות ראיון</h1>
      <p className="mt-2 text-muted">
        תוכן שנתרם על ידי חברי הקהילה. המידע עשוי להיות חלקי או לא מעודכן, ואינו מאומת על ידי החברות
        המוזכרות ואינו מבטיח את תהליך הראיון הנוכחי שלהן.
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
