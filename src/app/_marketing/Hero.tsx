import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import { MatchIllustration } from "./MatchIllustration";
import { SectionEyebrow } from "./SectionEyebrow";

const matchReasons = ["תחום ורמת ניסיון דומים", "מטרות תרגול משותפות", "זמינות מתאימה"];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper">
      <Container className="py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <Reveal delay={0.05}>
              <h1 className="mt-5 text-5xl leading-[1.06] font-black tracking-tight text-balance text-ink sm:text-6xl lg:text-[4rem]">
                הראיון הוא אישי. ההכנה אליו לא חייבת להיות.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                מצאו פרטנרים מהתחום, ברמת ניסיון ובשלב דומים לשלכם, ותרגלו יחד בעזרת מערכים מוכנים —
                בלי פרופיל ציבורי ובלי להיחשף לאנשים ממקום העבודה.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <LinkButton href="/register">מצאו לי אנשים במסלול שלי</LinkButton>
              </div>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-2">
                  <ShieldIcon />
                  יצירת פרופיל ללא עלות
                </span>
                <span aria-hidden>·</span>
                <span>מקום העבודה חסום מראש</span>
                <span aria-hidden>·</span>
                <span>פרטים מזהים נחשפים רק בהסכמה</span>
              </p>
            </Reveal>
          </div>

          <div>
            <Reveal delay={0.2} y={28}>
              <div className="mt-4">
                <MatchIllustration />
              </div>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="mt-6 rounded-sm border border-ink/12 bg-white p-5 sm:p-6">
                <h3 className="text-sm font-bold text-ink">למה זו התאמה טובה?</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {matchReasons.map((reason) => (
                    <li
                      key={reason}
                      className="inline-flex items-center gap-1.5 rounded-sm border border-calm/20 bg-lime/50 px-2.5 py-1 text-xs font-medium text-ink"
                    >
                      <CheckIcon />
                      {reason}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-start gap-2 border-t border-ink/10 pt-4">
                  <EyeOffIcon />
                  <p className="text-xs leading-relaxed text-ink/70">
                    הפרטים המזהים של שני הצדדים נשארים מוסתרים עד שיש עניין הדדי להתקדם.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-calm">
      <path
        d="M8 1.5 13.5 3.5V7.5C13.5 11 11.2 13 8 14.5C4.8 13 2.5 11 2.5 7.5V3.5L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="shrink-0 text-calm" aria-hidden>
      <path d="M2.5 8.2 6 11.5 13.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-ink/60" aria-hidden>
      <path
        d="M2 8c1.6-3 4-4.5 6-4.5S13.4 5 15 8c-1.6 3-4 4.5-6 4.5S3.6 11 2 8Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
