import { Avatar } from "@/shared/ui/Avatar";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";

const quotes = [
  {
    text: "לא הייתי צריך עוד מדריך לראיונות. הייתי צריך מישהו שנמצא באותו שלב ויכול להגיד לי אם התשובה שלי באמת עובדת.",
    attribution: "מפתח תוכנה",
    context: "מתוך מחקר משתמשים אנונימי",
  },
  {
    text: "יכולתי לתרגל מול חברים, אבל הם לא ידעו לשאול שאלות המשך מקצועיות. חיפשתי מישהו שמבין למה בחרתי בפתרון מסוים.",
    attribution: "מפתחת Full Stack",
    context: "מתוך מחקר משתמשים אנונימי",
  },
  {
    text: "רציתי לדבר עם אנשים מהתחום, אבל לא יכולתי להסתכן בכך שמישהו מהעבודה יראה שאני מחפש.",
    attribution: "מפתח Backend",
    context: "מתוך מחקר משתמשים אנונימי",
  },
];

export function Testimonials() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <Container>
        <Reveal>
          <h2 className="max-w-xl text-3xl leading-tight font-black tracking-tight text-ink sm:text-4xl">
            מה שמענו מאנשים שמתכוננים לראיונות
          </h2>
        </Reveal>
        <div className="mt-12 grid border-y border-ink/10 lg:grid-cols-3">
          {quotes.map((quote, i) => (
            <Reveal key={quote.text} delay={i * 0.1} y={20} className="h-full">
              <figure className="group flex h-full flex-col border-b border-ink/10 py-8 transition-colors hover:bg-paper lg:border-b-0 lg:border-s lg:px-8 lg:first:border-s-0">
                <span
                  className="font-mono text-4xl leading-none text-primary/35"
                  aria-hidden
                >
                  “
                </span>
                <blockquote className="mt-3 flex-1 text-lg leading-[1.75] text-ink">
                  {quote.text}
                </blockquote>
                <figcaption className="mt-7 flex items-center gap-3">
                  <Avatar
                    seed={quote.attribution}
                    size="sm"
                    className="ring-2 ring-white transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">
                      {quote.attribution}
                    </span>
                    <span className="block text-xs text-muted">
                      {quote.context}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
