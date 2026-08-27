import { Container } from "@/shared/ui/Container";

export function FormatsAndGuides() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <Container className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border p-8">
          <h3 className="text-xl font-bold text-ink">שיחה אחת על אחת, או קבוצה קטנה</h3>
          <p className="mt-3 text-muted">
            אחרי אישור הדדי אפשר לדבר, לתמוך אחד בשני, לשתף חוויות, לחשוב יחד וללמוד — חד־פעמי או
            קבוע, לפי מה שבחרתם. קבוצות קטנות (כ-4–6 אנשים) מתאימות זו לזו לפי תחום, רמת ניסיון,
            שפה ואזור זמן.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-paper p-8">
          <span className="rounded-full bg-lime/60 px-3 py-1 text-xs font-semibold text-primary-dark">
            תמיד אופציונלי
          </span>
          <h3 className="mt-3 text-xl font-bold text-ink">מדריכי מפגש, לא חובה</h3>
          <p className="mt-3 text-muted">
            למי שרוצה מסגרת לשיחה הראשונה — יש מדריכים קצרים עם נושאים ושאלות מנחות: שיתוף מטרות,
            חשיבה משותפת על בעיה מקצועית, ואפילו תרגול קוד או ראיון אם זה מה שמעניין את שניכם. שום
            מדריך אינו חובה, ואין דיווח נדרש על ביצוע.
          </p>
        </div>
      </Container>
    </section>
  );
}
