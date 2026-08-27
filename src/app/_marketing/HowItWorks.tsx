import { Container } from "@/shared/ui/Container";

const steps = [
  {
    n: "01",
    title: "בונים פרופיל מקצועי",
    body: "מעלים קורות חיים או ממלאים ידנית: תחום, תפקיד יעד, ניסיון, כישורים ושפות. הכל נשאר פרטי עד שאתם מחליטים אחרת.",
  },
  {
    n: "02",
    title: "מגדירים חיבור ופרטיות",
    body: "בוחרים מי לא לפגוש (מעסיק נוכחי, מעסיק קודם, חברות נוספות), איך תרצו להיראות לפני התאמה, ואיזה סוג חיבור מתאים לכם.",
  },
  {
    n: "03",
    title: "מתחברים אחרי אישור הדדי",
    body: "מקבלים הצעות התאמה מצומצמות ומוסברות. רק כששני הצדדים מאשרים, נפתח חיבור עם הפרטים שבחרתם לחשוף.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-16 sm:py-20">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-ink sm:text-4xl">איך זה עובד</h2>
          <p className="mt-4 text-lg text-muted">שלושה שלבים, בלי חשיפה מיותרת באף אחד מהם.</p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="rounded-2xl border border-border p-6">
              <span className="text-sm font-semibold text-primary">{step.n}</span>
              <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
