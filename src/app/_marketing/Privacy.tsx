import Link from "next/link";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import { PrimarySectionHeading } from "./PrimarySectionHeading";

const guarantees = [
  "מקום העבודה הנוכחי וחברות נוספות שתבחרו חסומים מראש",
  "הפרופיל מופיע רק במסגרת התאמות רלוונטיות",
  "אין חיפוש חופשי או מאגר פרופילים ציבורי",
  "השם ופרטים מזהים נחשפים בהדרגה ורק בהסכמה הדדית",
  "קורות החיים והמידע שלכם נשמרים אך ורק במערכת שלנו",
  "המידע לא מועבר לשום שירות צד־שלישי ולא נחשף לאף חברה או סוכנות",
];

export function Privacy() {
  return (
    <section id="privacy" className="bg-lime/55 py-16 sm:py-24">
      <Container>
        <Reveal>
          <PrimarySectionHeading tone="calm">איך הפרטיות שלי נשמרת</PrimarySectionHeading>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-8 bg-calm px-6 py-12 text-paper sm:px-12 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-5xl leading-tight font-black tracking-tight text-balance sm:text-6xl">
                למצוא את האנשים הנכונים, בלי להיחשף לאנשים הלא נכונים
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-paper/75">
                חיפוש עבודה הוא תהליך דיסקרטי. לכן הפרטיות ב־SamePath אינה תוספת — היא חלק מהדרך
                שבה המוצר עובד.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-3xl gap-px border border-paper/20 bg-paper/20 text-start sm:grid-cols-2">
              {guarantees.map((item) => (
                <div key={item} className="flex items-start gap-3 bg-calm p-4">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-paper/35 text-paper">
                    <CheckIcon />
                  </span>
                  <p className="text-sm leading-relaxed text-paper/90">{item}</p>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-base font-medium text-paper/90">
              אתם שולטים מי יכול לראות אתכם, מה הוא יכול לראות ומתי.
            </p>

            <div className="mt-6 text-center">
              <Link href="/privacy" className="text-sm font-semibold text-paper underline underline-offset-4 hover:text-paper/80">
                קראו עוד על הפרטיות ב־SamePath
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
