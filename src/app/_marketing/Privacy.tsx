import Link from "next/link";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import { PrimarySectionHeading } from "./PrimarySectionHeading";

const guarantees = [
  "מקום העבודה הנוכחי וחברות נוספות שתבחרו חסומים מראש",
  "המידע לא מועבר לשום שירות צד־שלישי ולא נחשף לאף חברה או סוכנות",
  "אין חיפוש חופשי או מאגר פרופילים ציבורי",
  "הפרופיל מופיע רק במסגרת התאמות רלוונטיות",
  "השם ופרטים מזהים נחשפים בהדרגה ורק בהסכמה הדדית",
  "קורות החיים והמידע שלכם נשמרים אך ורק במערכת שלנו",
];

export function Privacy() {
  return (
    <section
      id="privacy"
      className="relative isolate overflow-hidden bg-calm py-20 text-paper sm:py-28"
    >
      <div
        className="marketing-path-grid pointer-events-none absolute inset-0 -z-10 opacity-15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-56 -end-36 -z-10 size-[34rem] rounded-full bg-white/[0.04]"
        aria-hidden
      />
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
          <div>
            <Reveal>
              <PrimarySectionHeading
                tone="happy"
                className="justify-start text-start text-happy"
              >
                איך הפרטיות שלי נשמרת
              </PrimarySectionHeading>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-7 max-w-3xl text-4xl leading-[1.08] font-black tracking-[-0.035em] text-balance sm:text-6xl">
                למצוא את האנשים הנכונים, בלי להיחשף לאנשים הלא נכונים.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-2xl text-lg leading-[1.8] text-paper/75">
                חיפוש עבודה הוא תהליך דיסקרטי. לכן הפרטיות ב־SamePath אינה תוספת
                — היא חלק מהדרך שבה המוצר עובד.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.12} y={20}>
            <PrivacyDiagram />
          </Reveal>
        </div>

        <div className="mt-16 grid border-y border-paper/15 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {guarantees.map((item, i) => (
            <Reveal key={item} delay={(i % 3) * 0.06}>
              <div className="flex h-full items-start gap-3 border-b border-paper/15 py-6 sm:px-6 sm:odd:border-s lg:border-s lg:nth-[3n+1]:border-s-0">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-paper/30 text-happy"
                  aria-hidden
                >
                  <CheckIcon />
                </span>
                <p className="text-sm leading-[1.75] text-paper/85">{item}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <p className="max-w-2xl text-lg font-medium text-paper">
              אתם שולטים מי יכול לראות אתכם, מה הוא יכול לראות ומתי.
            </p>
            <Link
              href="#faq"
              className="shrink-0 text-sm font-semibold text-paper underline decoration-paper/40 underline-offset-4 transition-colors hover:decoration-paper"
            >
              קראו עוד על הפרטיות ב־SamePath
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 5 8.5 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 19.5 5.8V11c0 5-3.2 8-7.5 10-4.3-2-7.5-5-7.5-10V5.8L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.7 12.2 11 14.5l4.3-4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrivacyDiagram() {
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[28rem]"
      role="img"
      aria-label="המחשה של פרופיל מוגן, שנחשף רק בהתאמות רלוונטיות"
    >
      <div
        className="absolute inset-[7%] rounded-full border border-dashed border-paper/20"
        aria-hidden
      />
      <div
        className="absolute inset-[22%] rounded-full border border-paper/15"
        aria-hidden
      />
      <span
        className="animate-path-pulse absolute start-[11%] top-[21%] size-4 rounded-full border-4 border-calm bg-happy"
        aria-hidden
      />
      <span
        className="animate-path-pulse absolute end-[9%] top-[46%] size-3 rounded-full border-4 border-calm bg-paper/70 [animation-delay:700ms]"
        aria-hidden
      />
      <span
        className="animate-path-pulse absolute bottom-[13%] start-[37%] size-3.5 rounded-full border-4 border-calm bg-happy [animation-delay:1.4s]"
        aria-hidden
      />
      <svg
        className="absolute inset-0 size-full text-paper/20"
        viewBox="0 0 420 420"
        fill="none"
        aria-hidden
      >
        <path
          d="M80 112 172 182M342 208 250 210M177 337 202 259"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 8"
        />
      </svg>
      <div className="marketing-shadow absolute inset-[31%] flex items-center justify-center rounded-full border border-paper/25 bg-paper/10 backdrop-blur">
        <span
          className="flex size-20 items-center justify-center rounded-full bg-paper text-primary shadow-xl sm:size-24"
          aria-hidden
        >
          <ShieldIcon />
        </span>
      </div>
      <span
        className="absolute end-[14%] top-[14%] flex size-11 items-center justify-center rounded-full border border-paper/20 bg-calm-dark text-paper/70"
        aria-hidden
      >
        <EyeOffIcon />
      </span>
    </div>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M2.5 10c2-3.7 4.9-5.5 7.5-5.5s5.5 1.8 7.5 5.5c-2 3.7-4.9 5.5-7.5 5.5S4.5 13.7 2.5 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m4 4 12 12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
