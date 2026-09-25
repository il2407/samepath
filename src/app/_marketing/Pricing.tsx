import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { Reveal } from "@/shared/ui/Reveal";
import { PrimarySectionHeading } from "./PrimarySectionHeading";
import styles from "./landing.module.css";

const notes = [
  "אין חידוש אוטומטי",
  "גישה פעילה נדרשת רק ליצירת חיבורים חדשים",
  "הפרופיל וההגדרות נשמרים גם לאחר תום הגישה",
  "ההתאמה לא יצאה לפועל? אפשר לבקש החלפה",
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-paper py-20 sm:py-28">
      <Container>
        <Reveal>
          <PrimarySectionHeading
            tone="happy"
            className="justify-start text-start"
          >
            כמה זה עולה?
          </PrimarySectionHeading>
        </Reveal>

        <div className="mt-8 grid items-start gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20">
          <div>
            <Reveal delay={0.05}>
              <h2 className="text-4xl leading-[1.1] font-black tracking-[-0.035em] text-balance text-ink sm:text-5xl lg:text-6xl">
                לא משלמים מאות שקלים על עוד שעת לימוד פרטית. משלמים עשרות שקלים
                כדי למצוא התאמה אחת טובה.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-7 max-w-2xl space-y-4 text-lg leading-[1.8] text-muted">
                <p>
                  אם אתם צריכים ללמוד תחום חדש, מורה או קורס יכולים להתאים. אבל
                  אם הידע כבר קיים ואתם צריכים לתרגל, להסביר ולקבל משוב — לא
                  תמיד יש סיבה לשלם מאות שקלים על כל מפגש.
                </p>
                <p>
                  יצירת הפרופיל ובדיקת ההתאמות הן ללא עלות. פרטי התשלום יוצגו
                  לפני יצירת החיבור, ללא חידוש אוטומטי.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} y={20}>
            <div className={`rounded-3xl p-6 sm:p-8 ${styles.pricingCard}`}>
              <p className="font-mono text-xs font-semibold text-muted">
                עלות בפועל, ביחס למה שמכירים
              </p>
              <div className="mt-8 space-y-8">
                <div>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-semibold text-ink">
                      שיעור פרטי / מנטורינג
                    </span>
                    <span className="font-mono text-xs text-muted">
                      מאות ₪ למפגש
                    </span>
                  </div>
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                    <div className="h-full w-full rounded-full bg-ink/20" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-semibold text-ink">SamePath</span>
                    <span className="font-mono text-xs font-semibold text-primary">
                      עשרות ₪ להתאמה
                    </span>
                  </div>
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-mint">
                    <div className="h-full w-[22%] rounded-full bg-primary" />
                  </div>
                </div>
              </div>
              <p className="mt-7 border-t border-ink/10 pt-5 text-xs leading-relaxed text-muted">
                יחס להמחשה בלבד — פרטי המחיר המדויקים מוצגים לפני יצירת כל
                חיבור.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-14 grid gap-10 border-y border-ink/10 py-9 lg:grid-cols-[1fr_auto] lg:items-center">
            <ul className="grid gap-x-10 gap-y-3 text-sm text-muted sm:grid-cols-2">
              {notes.map((note) => (
                <li key={note} className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary" aria-hidden>
                    ✓
                  </span>
                  {note}
                </li>
              ))}
            </ul>
            <div className="lg:text-end">
              <LinkButton href="/register" className="rounded-full">
                צרו פרופיל ללא עלות
              </LinkButton>
              <p className="mt-3 max-w-md text-sm text-muted">
                לא תתבקשו לשלם לפני שתוכלו לבדוק אם קיימות עבורכם התאמות
                רלוונטיות.
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
