import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import { cn } from "@/shared/ui/cn";
import { PrimarySectionHeading } from "./PrimarySectionHeading";

const benefits = [
  {
    n: "01",
    title: "התאמה מקצועית",
    body: "תרגלו עם אנשים שמכירים את התחום, נמצאים ברמת ניסיון דומה ומתכוננים לאתגרים דומים.",
    accent: "text-primary",
    tint: "bg-primary/10",
    icon: <MatchIcon />,
  },
  {
    n: "02",
    title: "תרגול מובנה",
    body: "בוחרים מראש מערך תרגול, מיישרים ציפיות ומגיעים למפגש כשברור על מה עובדים ואיך נותנים משוב.",
    accent: "text-happy-dark",
    tint: "bg-happy/15",
    icon: <StructuredIcon />,
  },
  {
    n: "03",
    title: "דיסקרטיות מובנית",
    body: "חיפוש עבודה הוא עניין רגיש. לכן אין ב־SamePath פרופיל ציבורי: אתם בוחרים ממי להישאר מוסתרים, בפני מי להיחשף ומתי לשתף פרטים מזהים.",
    accent: "text-calm",
    tint: "bg-calm/10",
    icon: <DiscretionIcon />,
  },
];

export function WhySamePath() {
  return (
    <section className="relative bg-white py-20 sm:py-28">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <PrimarySectionHeading className="justify-start text-start">
                למה SamePath
              </PrimarySectionHeading>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-6 text-4xl leading-[1.08] font-black tracking-[-0.035em] text-balance text-ink sm:text-5xl lg:text-6xl">
                יש לכם כבר מה לתרגל. אנחנו נעזור לכם למצוא עם מי.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-7 max-w-xl text-lg leading-[1.85] text-muted">
                יש אינסוף מדריכים, קורסים ושאלות לראיונות. אבל חומר לבדו לא יכול
                לדמות ראיון אמיתי או לתת לכם משוב מקצועי. מה שחסר הוא מישהו
                מהתחום לתרגל איתו — ודרך דיסקרטית למצוא אותו. SamePath מחברת
                אתכם לאנשים שנמצאים בשלב דומה, כדי שתוכלו לעשות סימולציות,
                להשתפר יחד ולהגיע מוכנים יותר לראיון הבא.
              </p>
            </Reveal>
          </div>

          <div className="relative border-y border-ink/10">
            <span
              className="absolute bottom-10 start-6 top-10 w-px bg-primary/15 sm:start-9"
              aria-hidden
            />
            {benefits.map((benefit, i) => (
              <Reveal key={benefit.title} delay={i * 0.08} y={18}>
                <article className="group relative grid gap-5 border-b border-ink/10 py-8 ps-16 last:border-b-0 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-7 sm:py-10 sm:ps-20">
                  <span
                    className={cn(
                      "absolute start-0 top-8 z-10 flex size-12 items-center justify-center rounded-full border-4 border-white transition-transform duration-300 group-hover:scale-110 sm:top-10 sm:size-16",
                      benefit.tint,
                      benefit.accent,
                    )}
                    aria-hidden
                  >
                    {benefit.icon}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs font-bold",
                      benefit.accent,
                    )}
                  >
                    {benefit.n}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-ink">
                      {benefit.title}
                    </h3>
                    <p className="mt-3 max-w-lg text-base leading-[1.8] text-muted">
                      {benefit.body}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function MatchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle
        cx="7.5"
        cy="10"
        r="4.3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="12.5"
        cy="10"
        r="4.3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function StructuredIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="3.5"
        width="13"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6.5 8h7M6.5 11.3h7M6.5 14.6h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DiscretionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2.5 16.5 5V9.5C16.5 13.5 13.8 16 10 17.5C6.2 16 3.5 13.5 3.5 9.5V5L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7.3 10.1 9.3 12l3.4-3.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
