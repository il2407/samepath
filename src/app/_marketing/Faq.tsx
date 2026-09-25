import type { ReactNode } from "react";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "האם אנשים ממקום העבודה שלי, או מחברות שאבחר לחסום, יוכלו לראות אותי?",
    a: "לא. במהלך יצירת הפרופיל מציינים את מקום העבודה הנוכחי, וניתן להוסיף חברות נוספות שמהן תרצו להישאר מוסתרים. המערכת משתמשת בהגדרות האלה כדי למנוע הופעה בהתאמות מול אנשים מאותן חברות. בנוסף, אין ב־SamePath חיפוש חופשי או מאגר פרופילים ציבורי — הפרופיל שלכם אף פעם לא פתוח לעיון חופשי, והוא מוצג רק כחלק מהתאמות ספציפיות שהמערכת מייצרת עבורכם, בכפוף לאותן הגדרות פרטיות.",
  },
  {
    q: "מתי ואיך נחשפים השם והפרטים המזהים שלי?",
    a: "השם ופרטים מזהים אחרים נשארים מוסתרים לגמרי בשלבים הראשונים של ההתאמה. הם נחשפים בהדרגה, ורק כאשר שני הצדדים מביעים עניין הדדי להתקדם — כלומר אף צד לא יכול לחשוף את הפרטים של עצמו לבד או לגלות את זהות הצד השני בלי הסכמה הדדית. כך אפשר לבחון אם ההתאמה נראית מבטיחה עוד לפני שמישהו יודע מי אתם.",
  },
  {
    q: "איך נקבעת ההתאמה, ומי הם הפרטנרים שאני נפגש איתם?",
    a: (
      <>
        <p>
          ההתאמה נבנית בשני שלבים: קודם בדיקת פרטיות וזכאות (למשל, חברות שסימנתם
          כחסומות), ורק אם הכול תקין — חישוב ציון תאימות שהופך לאחוז ההתאמה שאתם
          רואים.
        </p>
        <p className="mt-3">
          האחוז משקלל יחד כמה גורמים, לפי סדר ההשפעה שלהם על הציון:
        </p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>
            <strong className="text-ink">המשפיעים ביותר:</strong> תפקיד היעד
            שאתם מחפשים והתחום המקצועי.
          </li>
          <li>
            <strong className="text-ink">השפעה בינונית:</strong> רמת הניסיון
            וחפיפת הזמינות.
          </li>
          <li>
            <strong className="text-ink">משלימים את התמונה:</strong> כישורים
            משותפים, אזור זמן וסגנון החיבור המועדף.
          </li>
        </ul>
        <p className="mt-3">
          הפרטנרים עצמם אינם מורים או מנטורים — אלה אנשים מהתחום שנמצאים ברמת
          ניסיון ובשלב דומים לשלכם, לתרגול הדדי: שני הצדדים מתרגלים, מראיינים
          ונותנים משוב זה לזה באותה מידה. ליד כל הצעה מוצגים גם עד שלושה גורמים
          חזקים שגרמו לה להתאים, עם האחוז הספציפי של כל אחד מהם — וההצעות תמיד
          מסודרות מהאחוז הגבוה ביותר לנמוך ביותר.
        </p>
      </>
    ),
  },
  {
    q: "מה עושים בפועל במהלך מפגש תרגול?",
    a: "לפני המפגש בוחרים יחד מערך תרגול מוכן, כדי ששני הצדדים יגיעו מתואמים. המערך כולל תרגיל או שאלת ריאיון, הצעה לחלוקת תפקידים וזמנים, שאלות הבהרה והמשך, וגם נקודות מוגדרות למתן משוב — כך שלא צריך להמציא מבנה מאפס. בסיום אפשר להחליט יחד אם להמשיך להיפגש ולהתקדם בקצב שמתאים לכם.",
  },
  {
    q: "האם זה עולה כסף, ומה קורה אם ההתאמה לא יוצאת לפועל?",
    a: "לא. יצירת הפרופיל, בדיקת ההתאמות והצטרפות ל-SamePath הן ללא עלות לגמרי. כל משתמש חדש מקבל אוטומטית 30 יום של גישה חינמית להשלמת חיבורים, וניתן להאריך את הגישה בלי תשלום — על ידי שיתוף חוויית ריאיון משלכם, שלאחר אישור צוות המודרציה מזכה בקרדיטים הניתנים להמרה לימי גישה נוספים. ואם האדם שאליו התחברתם לא הגיע, או שהחיבור מכל סיבה אחרת לא יצא לפועל, אפשר לבקש החלפה בהתאם למדיניות ההחלפות של SamePath.",
  },
  {
    q: "האם מובטח שאצליח בריאיון?",
    a: "לא. SamePath אינה יכולה, ואינה מבטיחה, תוצאה בתהליך קבלה לעבודה. מה שכן — המוצר נותן לכם מקום עקבי לתרגל בו בפועל, לקבל משוב אמיתי מאנשים שמכירים את התחום שלכם, ולחדד את דרך החשיבה וההסברים שלכם לפני שהם נבחנים בריאיון האמיתי.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-warm-surface py-20 sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.65fr_1.35fr] lg:gap-20">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <h2 className="text-5xl leading-none font-black tracking-[-0.04em] text-balance text-ink sm:text-6xl">
                שאלות נפוצות
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="divide-y divide-ink/12 border-y border-ink/12">
              {faqs.map((item) => (
                <details key={item.q} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold text-ink transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-focus">
                    {item.q}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 font-mono text-primary transition-transform group-open:rotate-45 group-open:bg-primary group-open:text-white">
                      +
                    </span>
                  </summary>
                  <div className="mt-4 max-w-2xl pe-12 text-base leading-[1.8] text-muted">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
