import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import { MatchIllustration } from "./MatchIllustration";
import { SectionEyebrow } from "./SectionEyebrow";
import styles from "./landing.module.css";

export function Hero() {
  return (
    <section className={`relative isolate overflow-hidden bg-paper ${styles.hero}`}>
      <Container className="py-8 sm:py-10">
        <div className="grid min-h-[540px] items-start gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16">
          <div className="relative z-10">
            <Reveal>
              <SectionEyebrow>
                קהילה מקצועית ודיסקרטית לחיפוש עבודה
              </SectionEyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.65rem,4.5vw,4.25rem)] leading-[0.98] font-black tracking-[-0.045em] text-balance text-ink">
                במקום לדמיין איך ייראה ראיון העבודה הבא.
                <br />
                תסמלצו אותו.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-2xl text-lg leading-[1.7] text-muted">
                מצאו פרטנרים מהתחום, ברמת ניסיון ובשלב דומים לשלכם, ותרגלו יחד
                בעזרת מערכי סימולציות מוכנים. תהליך ההתאמה נעשה בדיסקרטיות, כך
                שרק אתם קובעים בפני מי להיחשף וממי להישאר מוסתרים.
              </p>
            </Reveal>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <LinkButton
                href="/register"
                className="rounded-full px-7 py-3.5 shadow-[0_14px_30px_-16px_rgba(35,92,71,0.9)]"
              >
                מצאו לי אנשים במסלול שלי
              </LinkButton>
              <LinkButton
                href="#how-it-works"
                variant="secondary"
                className="rounded-full bg-paper/70 px-7 py-3.5"
              >
                לראות איך זה עובד
              </LinkButton>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink/10 pt-5 text-sm text-muted">
              <li className="inline-flex items-center gap-2">
                <ShieldIcon />
                יצירת פרופיל ללא עלות
              </li>
              <li className="inline-flex items-center gap-2">
                <CheckIcon />
                מקום העבודה חסום מראש
              </li>
              <li className="inline-flex items-center gap-2">
                <CheckIcon />
                פרטים מזהים נחשפים רק בהסכמה
              </li>
            </ul>
          </div>

          <div className="relative lg:ps-4">
            <Reveal delay={0.2} y={28}>
              <MatchIllustration />
            </Reveal>
          </div>
        </div>
      </Container>
      <svg className={styles.waves} viewBox="0 0 1440 120" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path d="M0 54C240 110 360 0 600 35S1080 104 1440 16V120H0Z" fill="#b5c1d8" />
        <path d="M0 80C260 128 420 20 700 64S1140 110 1440 48V120H0Z" fill="#e3e7ee" />
        <path d="M0 105C260 139 490 45 780 88S1200 128 1440 85V120H0Z" fill="#3e4b63" />
      </svg>
    </section>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-calm"
    >
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
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-calm"
      aria-hidden
    >
      <path
        d="M2.5 8.2 6 11.5 13.5 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

