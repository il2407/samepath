import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";

export function Hero() {
  return (
    <section className="overflow-hidden bg-gradient-to-b from-mint to-paper">
      <Container className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <span className="inline-flex items-center rounded-full border border-border bg-white px-4 py-1.5 text-sm font-medium text-primary-dark">
            קהילה מקצועית דיסקרטית
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight text-ink sm:text-5xl lg:text-6xl">
            אנשים בדרך שלך.
            <br />
            בלי להיחשף בדרך.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            SamePath מחברת בין אנשים באותו תחום מקצועי, באותה רמת ניסיון, שמחפשים תפקיד דומה — בלי
            לחשוף לעולם, ובטח לא לקולגות, שאתם מחפשים. הכל בקצב שלכם, ובלי לפגוש מישהו שעובד איתכם
            או שאתם לא רוצים שיידע.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <LinkButton href="/register">להצטרפות לקהילה</LinkButton>
            <LinkButton href="#how-it-works" variant="secondary">
              איך ההתאמה עובדת
            </LinkButton>
          </div>
          <p className="mt-4 text-sm text-muted">
            יצירת פרופיל וזיהוי התאמות רלוונטיות — ללא עלות. תשלום רק כשיש עם מי להתחבר.
          </p>
        </div>
        <HeroMatchCard />
      </Container>
    </section>
  );
}

function HeroMatchCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-lime/40 blur-2xl" aria-hidden />
      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        <p className="text-xs font-medium text-muted">הצעת התאמה אנונימית</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-mint text-lg font-semibold text-primary-dark">
            א׳
          </div>
          <div>
            <p className="font-semibold text-ink">מפתח/ת Backend, בכיר/ה</p>
            <p className="text-sm text-muted">מחפש/ת: תפקיד Backend / Full Stack</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2 text-sm text-muted">
          <li className="flex items-center gap-2">
            <Dot /> כ-5 שנות ניסיון, כמוכם בערך
          </li>
          <li className="flex items-center gap-2">
            <Dot /> זמינות דומה לפגישות שבועיות
          </li>
          <li className="flex items-center gap-2">
            <Dot /> מעוניין/ת בליווי הדדי בתהליך חיפוש
          </li>
        </ul>
        <div className="mt-5 flex gap-2">
          <span className="flex-1 rounded-full bg-paper px-4 py-2 text-center text-sm font-medium text-muted">
            לא עכשיו
          </span>
          <span className="flex-1 rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-white">
            רוצה להתחבר
          </span>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          שם מלא, תמונה ומקום עבודה נחשפים רק לאחר הסכמה הדדית
        </p>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />;
}
