import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import styles from "./landing.module.css";

export function FinalCta() {
  return (
    <section className={`relative isolate overflow-hidden py-20 sm:py-28 ${styles.finalCta}`}>
      <div
        className="marketing-path-grid pointer-events-none absolute inset-0 -z-10 opacity-10"
        aria-hidden
      />
      <Container>
        <Reveal>
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <span
              className="mb-7 flex size-16 items-center justify-center text-ink"
              aria-hidden
            >
              <PathIcon />
            </span>
            <h2 className="text-4xl leading-[1.05] font-black tracking-[-0.04em] text-balance text-ink sm:text-6xl">
              לא צריך להתכונן לראיונות לבד.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-[1.8] text-muted">
              אנשים מהתחום שלכם, ברמת ניסיון דומה, מוכנים לתרגל יחד — בלי פרופיל
              ציבורי ובלי לעבור את זה לבד.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <LinkButton
                href="/register"
                className="rounded-full px-8 py-3.5 text-base"
              >
                מצאו לי אנשים במסלול שלי
              </LinkButton>
              <LinkButton
                href="#privacy"
                variant="secondary"
                className="rounded-full px-8 py-3.5 text-base"
              >
                קראו איך נשמרת הפרטיות
              </LinkButton>
            </div>
            <p className="mt-6 text-sm text-muted">
              ההרשמה דיסקרטית. שום מידע אינו מתפרסם באופן פומבי.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function PathIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M5 22c2.5-7.5 4.5-12 9-16M14 22c0-5 0-10 0-16M23 22c-2.5-7.5-4.5-12-9-16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="14" cy="5" r="2" fill="currentColor" />
    </svg>
  );
}
