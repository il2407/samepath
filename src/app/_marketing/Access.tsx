import { Container } from "@/shared/ui/Container";

export function Access() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="rounded-3xl bg-ink px-8 py-12 text-white sm:px-14">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold sm:text-4xl">גישה לתקופה קצובה — לא מנוי מתחדש</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/80">
            יצירת פרופיל ובדיקת התאמות רלוונטיות הן ללא עלות תמיד. תשלום נדרש רק לאחר שיש עם מי
            להתחבר בפועל. הגישה נפתחת לתקופה קצובה, בלי חידוש אוטומטי — תאריך התפוגה תמיד מוצג
            בבירור, ותקבלו תזכורת לפניו.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/70">
            <li>• פג התוקף? הפרופיל, ההגדרות והחיבורים הקיימים נשארים נגישים.</li>
            <li>• רוצים להתחבר או להצטרף לקבוצה חדשה — צריך גישה פעילה.</li>
            <li>• הצד השני לא הגיב או לא הגיע? זכאים להחלפה, בלי חשיפת דיווחים פרטיים.</li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
