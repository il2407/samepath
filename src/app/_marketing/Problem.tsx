import { Container } from "@/shared/ui/Container";

export function Problem() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl font-bold text-ink sm:text-4xl">
            אתם לא לבד בחיפוש — אבל קשה לדעת מי עוד בדרך
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            הרבה אנשים בתחום שלכם נמצאים באותו שלב בדיוק: בודקים אופציות, מתכוננים לראיונות, שוקלים
            מעבר. אבל אף אחד לא מפרסם את זה בפומבי — לא לקולגות, לא למנהל, ולא לרשת המקצועית. התוצאה
            היא שהתהליך נשאר בודד, גם כשיש סביבכם בדיוק את מי שהיה יכול להבין ולעזור.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-warm-surface p-8">
          <p className="font-semibold text-ink">SamePath קיימת בשביל לגשר על זה:</p>
          <ul className="mt-4 space-y-3 text-muted">
            <li>למצוא אנשים באותה רמה שמחפשים תפקיד דומה, בלי לחפש בעצמכם ברשת.</li>
            <li>להתחבר רק אחרי אישור הדדי — ולא לפני.</li>
            <li>לוודא שמעולם לא תיחשפו לעמית, מנהל, או מישהו מהחברה שלכם.</li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
