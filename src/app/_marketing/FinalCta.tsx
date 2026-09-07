import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";

export function FinalCta() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <Container>
        <Reveal>
          <div className="bg-ink px-6 py-14 text-center sm:px-14 sm:py-20">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
              <h2 className="text-4xl leading-tight font-black tracking-tight text-balance text-paper sm:text-5xl">
                לא צריך להתכונן לראיונות לבד.
              </h2>
              <p className="text-lg leading-relaxed text-paper/70">
                אנשים מהתחום שלכם, ברמת ניסיון דומה, מוכנים לתרגל יחד — בלי פרופיל ציבורי ובלי
                לעבור את זה לבד.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
                <LinkButton href="/register" className="px-8 py-3.5 text-base">
                  מצאו לי אנשים במסלול שלי
                </LinkButton>
                <LinkButton
                  href="#privacy"
                  variant="secondary"
                  className="border-paper/35 px-8 py-3.5 text-base text-paper hover:border-paper hover:bg-paper hover:text-ink"
                >
                  קראו איך נשמרת הפרטיות
                </LinkButton>
              </div>
              <p className="text-sm text-paper/60">ההרשמה דיסקרטית. שום מידע אינו מתפרסם באופן פומבי.</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
