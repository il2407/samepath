import { Container } from "@/shared/ui/Container";

const faqs = [
  {
    q: "מישהו מהחברה שלי יכול לגלות שאני ב-SamePath?",
    a: "לא. הפרופיל שלכם אינו ציבורי, לא ניתן לחיפוש ולא נגיש דרך מדריך חברים. אתם גם לעולם לא תוצגו למישהו שעובד היום באותה חברה כמוכם, וגם לא נחשפים בפני מי שחסמתם.",
  },
  {
    q: "מה בדיוק רואים עליי לפני שאני מאשר/ת חיבור?",
    a: "רק תחום מקצועי, קטגוריית תפקיד, טווח ניסיון, תפקיד יעד, כישורים ושפות, זמינות כללית וסוג החיבור המבוקש — יחד עם היכרות קצרה ואנונימית. שם, תמונה, מעסיק, קורות חיים ופרטי קשר לא נחשפים עד לאישור הדדי.",
  },
  {
    q: "האם זו פלטפורמת הכנה לראיונות?",
    a: "לא. SamePath היא בראש ובראשונה קהילה שמחברת בין אנשים בתהליך חיפוש דומה. תרגול ראיונות הוא נושא אופציונלי אחד מיני רבים שאפשר לבחור בו בשיחה — לא הליבה של המוצר.",
  },
  {
    q: "מה קורה כשהגישה שלי פגה?",
    a: "אתם ממשיכים לראות את הפרופיל, ההגדרות, החיבורים הקיימים וההיסטוריה שלכם. פשוט לא תוכלו לקבל התאמות חדשות או להצטרף לקבוצות חדשות עד להפעלת גישה נוספת.",
  },
  {
    q: "אפשר למחוק את החשבון וכל המידע?",
    a: "כן, בכל שלב, מתוך ההגדרות. ייצוא ומחיקת נתונים זמינים תמיד ולא מותנים בשום פעולה אחרת.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-white py-16 sm:py-20">
      <Container className="max-w-3xl">
        <h2 className="text-3xl font-bold text-ink sm:text-4xl">שאלות נפוצות</h2>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
          {faqs.map((item) => (
            <details key={item.q} className="group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                {item.q}
                <span className="shrink-0 text-primary transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
