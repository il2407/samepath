import { Container } from "@/shared/ui/Container";

const rules = [
  {
    title: "אף פעם לא עמיתים לעבודה",
    body: "המערכת חוסמת התאמה עם מישהו שעובד היום באותה חברה כמוכם — באופן אוטומטי, בלי יוצא מן הכלל.",
  },
  {
    title: "חסימת קבוצת חברות שלמה",
    body: "אפשר לחסום גם חברות בת וחברות קשורות לחברה הנוכחית שלכם — ברירת המחדל הבטוחה כשהקשר ידוע.",
  },
  {
    title: "חסימות אישיות משלכם",
    body: "מעסיק לשעבר, חברה שבה אתם בתהליך ריאיון, לקוח, ספק, או כל חברה אחרת — אתם מחליטים מה לחסום.",
  },
  {
    title: "חסימת משתמשים",
    body: "אפשר לחסום כל משתמש ספציפי, בכל שלב, מכל סיבה.",
  },
  {
    title: "בדיקת פרטיות לפני כל חשיפה",
    body: "הבדיקה רצה לפני שמוצגת התאמה, לפני אישור חיבור, לפני הצגת קבוצה, ולפני הרשמה למפגש קהילתי.",
  },
  {
    title: "בלי לחשוף למה משהו הוסתר",
    body: "אם קבוצה או מועמד/ת מוסתרים בגללכם, פשוט לא יוצגו — בלי הסבר שיחשוף מי חסם את מי.",
  },
];

export function Privacy() {
  return (
    <section id="privacy" className="py-16 sm:py-20">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-ink sm:text-4xl">פרטיות היא לא הגדרה — היא הבסיס</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            כל התאמה, כל קבוצה וכל הרשמה למפגש עוברות דרך שכבת פרטיות לפני שהן מוצגות בכלל. ציון
            התאמה מקצועי לעולם לא יכול לעקוף כלל פרטיות.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <div key={rule.title} className="rounded-2xl bg-mint p-6">
              <h3 className="font-semibold text-primary-dark">{rule.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{rule.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-2xl border border-border bg-white p-6">
          <h3 className="font-semibold text-ink">חשיפה הדרגתית של זהות</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            לפני אישור הדדי מוצגים רק: תחום מקצועי, קטגוריית תפקיד, טווח ניסיון, תפקיד יעד, כישורים
            נבחרים, שפות, זמינות כללית וסוג החיבור המבוקש — יחד עם היכרות קצרה ואנונימית. שם מלא,
            תמונה, מעסיק נוכחי, קורות חיים, קישור ל-LinkedIn, אימייל, טלפון ומיקום מדויק אינם
            מוצגים כלל עד לאישור הדדי, ורק אז נחשפים לפי מה שבחרתם לחשוף.
          </p>
        </div>
      </Container>
    </section>
  );
}
