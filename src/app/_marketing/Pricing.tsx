import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import { PrimarySectionHeading } from "./PrimarySectionHeading";

const notes = [
  "אין חידוש אוטומטי",
  "גישה פעילה נדרשת רק ליצירת חיבורים חדשים",
  "הפרופיל וההגדרות נשמרים גם לאחר תום הגישה",
  "ההתאמה לא יצאה לפועל? אפשר לבקש החלפה",
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-sand/75 py-16 sm:py-24">
      <Container>
        <Reveal>
          <PrimarySectionHeading tone="happy">כמה זה עולה?</PrimarySectionHeading>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-8 border border-ink/12 bg-white px-6 py-10 sm:px-12 sm:py-14">
            <div className="max-w-2xl">
              <h2 className="text-5xl leading-tight font-black tracking-tight text-balance text-ink sm:text-6xl">
                לא משלמים מאות שקלים על עוד שעת לימוד פרטית. משלמים עשרות שקלים כדי למצוא התאמה אחת טובה.
              </h2>
              <div className="mt-4 space-y-3 text-lg leading-relaxed text-muted">
                <p>
                  אם אתם צריכים ללמוד תחום חדש, מורה או קורס יכולים להתאים. אבל אם הידע כבר קיים
                  ואתם צריכים לתרגל, להסביר ולקבל משוב — לא תמיד יש סיבה לשלם מאות שקלים על כל
                  מפגש.
                </p>
                <p>
                  יצירת הפרופיל ובדיקת ההתאמות הן ללא עלות. פרטי התשלום יוצגו לפני יצירת החיבור,
                  ללא חידוש אוטומטי.
                </p>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                {notes.map((note) => (
                  <li key={note} className="flex items-start gap-2">
                    <span className="mt-1 font-mono text-primary" aria-hidden>
                      —
                    </span>
                    {note}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <LinkButton href="/register">צרו פרופיל ללא עלות</LinkButton>
                <p className="mt-3 text-sm text-muted">
                  לא תתבקשו לשלם לפני שתוכלו לבדוק אם קיימות עבורכם התאמות רלוונטיות.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
