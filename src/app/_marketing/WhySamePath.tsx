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
  },
  {
    n: "02",
    title: "תרגול מובנה",
    body: "בוחרים מראש מערך תרגול, מיישרים ציפיות ומגיעים למפגש כשברור על מה עובדים ואיך נותנים משוב.",
    accent: "text-happy-dark",
  },
  {
    n: "03",
    title: "דיסקרטיות מובנית",
    body: "חיפוש עבודה הוא עניין רגיש. לכן אין ב־SamePath פרופיל ציבורי: אתם בוחרים ממי להישאר מוסתרים, בפני מי להיחשף ומתי לשתף פרטים מזהים.",
    accent: "text-calm",
  },
];

export function WhySamePath() {
  return (
    <section className="bg-paper py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <PrimarySectionHeading>למה SamePath</PrimarySectionHeading>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-4 text-4xl leading-tight font-black tracking-tight text-balance text-ink sm:text-5xl">
         יש לכם כבר מה לתרגל. אנחנו נעזור לכם למצוא עם מי .            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed text-muted">
יש אינסוף מדריכים, קורסים ושאלות לראיונות. אבל חומר לבדו לא יכול לדמות ראיון אמיתי או לתת לכם משוב מקצועי. מה שחסר הוא מישהו מהתחום לתרגל איתו — ודרך דיסקרטית למצוא אותו. SamePath מחברת אתכם לאנשים שנמצאים בשלב דומה, כדי שתוכלו לעשות סימולציות, להשתפר יחד ולהגיע מוכנים יותר לראיון הבא.            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden border border-ink/12 bg-ink/12 sm:grid-cols-3">
          {benefits.map((benefit, i) => (
            <Reveal key={benefit.title} delay={i * 0.1} className="h-full">
              <div className="h-full bg-white p-6">
                <span className={cn("font-mono text-xs font-semibold", benefit.accent)}>{benefit.n}</span>
                <h3 className="mt-3 text-lg font-bold text-ink">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{benefit.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
