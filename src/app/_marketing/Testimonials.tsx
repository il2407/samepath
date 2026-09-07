import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";

const quotes = [
  {
    text: "לא הייתי צריך עוד מדריך לראיונות. הייתי צריך מישהו שנמצא באותו שלב ויכול להגיד לי אם התשובה שלי באמת עובדת.",
    attribution: "מפתח תוכנה, מתוך מחקר משתמשים אנונימי",
  },
  {
    text: "יכולתי לתרגל מול חברים, אבל הם לא ידעו לשאול שאלות המשך מקצועיות. חיפשתי מישהו שמבין למה בחרתי בפתרון מסוים.",
    attribution: "מפתחת Full Stack, מתוך מחקר משתמשים אנונימי",
  },
  {
    text: "רציתי לדבר עם אנשים מהתחום, אבל לא יכולתי להסתכן בכך שמישהו מהעבודה יראה שאני מחפש.",
    attribution: "מפתח Backend, מתוך מחקר משתמשים אנונימי",
  },
];

export function Testimonials() {
  return (
    <section className="bg-paper py-12 sm:py-16">
      <Container>
        <Reveal>
          <h2 className="text-center text-base font-medium text-muted">מה שמענו מאנשים שמתכוננים לראיונות</h2>
        </Reveal>
        <div className="mt-8 grid gap-px overflow-hidden border border-ink/12 bg-ink/12 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((quote, i) => (
            <Reveal key={quote.text} delay={i * 0.1} className="h-full">
              <figure className="flex h-full flex-col bg-white p-6">
                <span className="font-mono text-2xl leading-none text-primary/50" aria-hidden>
                  “
                </span>
                <blockquote className="mt-1 text-base leading-relaxed text-ink">{quote.text}</blockquote>
                <figcaption className="mt-4 text-sm text-muted">{quote.attribution}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
