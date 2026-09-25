"use client";

import { useMemo, useState } from "react";
import { Container } from "@/shared/ui/Container";
import { LinkButton } from "@/shared/ui/Button";
import { Reveal } from "@/shared/ui/Reveal";
import { cn } from "@/shared/ui/cn";
import {
  PrimarySectionHeading,
  SubsectionHeading,
} from "./PrimarySectionHeading";

const steps = [
  {
    n: "01",
    title: "מגדירים מה מתאים לכם",
    body: "מספרים לנו על הניסיון שלכם, מה תרצו לתרגל, מתי אתם פנויים ומאילו אנשים או חברות חשוב לכם להישאר מוסתרים.",
    icon: <PreferencesIcon />,
    accent: "text-primary",
  },
  {
    n: "02",
    title: "מקבלים התאמות",
    body: "SamePath מציגה לכם אנשים עם רקע, מטרות וזמינות מתאימים — בהתאם להגדרות הפרטיות שלכם.",
    icon: <MatchSparkIcon />,
    accent: "text-happy-dark",
  },
  {
    n: "03",
    title: "בוחרים ומתחילים לתרגל",
    body: "כשיש עניין הדדי, נחשפים הפרטים הדרושים לחיבור. בוחרים מערך תרגול, מתאמים מפגש ומתחילים לעבוד יחד.",
    icon: <StartIcon />,
    accent: "text-calm",
  },
];

type GuideStepSpec = {
  title: string;
  detail: string;
  durationMinutes: number;
  /** Set only on the step that's a concrete exercise/question worth calling out — not every PROMPT-kind step. */
  highlightLabel?: string;
};

type CategorySlug =
  "intro" | "project-presentation" | "coding" | "system-design";

// Slugs and labels kept in sync with PRACTICE_SESSION_CATEGORIES (src/modules/guides/service.ts) —
// the same categories used when picking a session guide inside a real connection.
const GUIDE_CATEGORIES: { slug: CategorySlug; labelHe: string }[] = [
  { slug: "intro", labelHe: "פגישת היכרות בווידאו" },
  { slug: "project-presentation", labelHe: "הצגת פרויקט וארכיטקטורה" },
  { slug: "coding", labelHe: "תרגול קוד" },
  { slug: "system-design", labelHe: "תרגול עיצוב מערכות" },
];

// One real, published guide per category (content mirrors prisma/seed/guides.ts) so the landing
// page never shows a made-up structure or timing.
const SAMPLE_GUIDES: Record<
  CategorySlug,
  { title: string; format: string; topic: string; steps: GuideStepSpec[] }
> = {
  intro: {
    title: "היכרות ראשונה",
    format: "מפגש אחד על אחד",
    topic: "היכרות ראשונה",
    steps: [
      {
        title: "פתיחה",
        durationMinutes: 5,
        detail:
          "שתפו קצר מי אתם מקצועית ומה מביא אתכם ל-SamePath, בלי לחשוף פרטים מזהים.",
      },
      {
        title: "המצב הנוכחי",
        durationMinutes: 10,
        detail: "מה שלב תהליך החיפוש שלכם היום? מה הכי מאתגר בו כרגע?",
        highlightLabel: "נושא לשיחה",
      },
      {
        title: "מה תרצו מהחיבור הזה",
        durationMinutes: 10,
        detail:
          "ליווי קבוע? שיחה חד-פעמית? תרגול משותף — קוד, עיצוב מערכות, הצגת פרויקט?",
      },
      {
        title: "המשך אפשרי",
        durationMinutes: 5,
        detail: "אם היה נעים — האם יש טעם לקבוע מפגש ממוקד יותר בפעם הבאה?",
      },
    ],
  },
  "project-presentation": {
    title: "הצגת פרויקט וארכיטקטורה",
    format: "מפגש אחד על אחד",
    topic: "הצגת פרויקט וארכיטקטורה",
    steps: [
      {
        title: "קביעת סדר",
        durationMinutes: 1,
        detail: "קבעו מי מציג/ה קודם — אין קריטריון מיוחד, פשוט תחליטו.",
      },
      {
        title: "הצגת הפרויקט",
        durationMinutes: 8,
        detail:
          "הציגו פרויקט שעבדתם עליו: הבעיה שהוא פותר, הארכיטקטורה הכללית, וההחלטות הטכניות המרכזיות שקיבלתם.",
        highlightLabel: "מוקד ההצגה",
      },
      {
        title: "הקשבה ושאלות",
        durationMinutes: 8,
        detail:
          "הקשיבו ושאלו שאלות מבהירות. כיוונים שיכולים לעזור: מה היה האתגר הטכני הכי גדול? איפה היו צווארי הבקבוק? מה הייתם עושים אחרת היום? איך הייתם מרחיבים את זה פי 10? איך התמודדתם עם כשלים ומקרי קצה?",
      },
      {
        title: "רפלקציה נפרדת",
        durationMinutes: 4,
        detail:
          "המקשיב/ה: רשמו משוב קצר על ההצגה. המציג/ה: רשמו לעצמכם מה היה כדאי להבהיר יותר.",
      },
      {
        title: "החלפת תפקידים",
        durationMinutes: 0,
        detail: "עכשיו תורכם — מי שהקשיב/ה מציג/ה.",
      },
      {
        title: "הצגת הפרויקט (סבב שני)",
        durationMinutes: 8,
        detail:
          "הציגו פרויקט שעבדתם עליו: הבעיה שהוא פותר, הארכיטקטורה הכללית, וההחלטות הטכניות המרכזיות שקיבלתם.",
      },
      {
        title: "הקשבה ושאלות (סבב שני)",
        durationMinutes: 8,
        detail: "הקשיבו ושאלו שאלות מבהירות, באותם כיוונים כמו בסבב הראשון.",
      },
      {
        title: "רפלקציה נפרדת (סבב שני)",
        durationMinutes: 4,
        detail:
          "המקשיב/ה: רשמו משוב קצר על ההצגה. המציג/ה: רשמו לעצמכם מה היה כדאי להבהיר יותר.",
      },
    ],
  },
  coding: {
    title: "תרגול קוד: Two Sum",
    format: "מתאים למפגש אחד-על-אחד ולמפגש קבוצתי",
    topic: "Two Sum",
    steps: [
      {
        title: "גישה ראשונית",
        durationMinutes: 3,
        detail:
          "קוראים את השאלה יחד. לפני שכותבים קוד, מדברים על גישה אפשרית ועל סיבוכיות משוערת.",
      },
      {
        title: "פתרון משותף",
        durationMinutes: 20,
        detail:
          "בהינתן מערך מספרים שלמים ומספר יעד, מצאו את האינדקסים של שני איברים שסכומם שווה ליעד. אפשר להניח שיש פתרון יחיד, ואי אפשר להשתמש באותו איבר פעמיים.",
        highlightLabel: "שאלה לדוגמה",
      },
      {
        title: "דיון בטרייד-אופים",
        durationMinutes: 7,
        detail:
          "מה הסיבוכיות בזמן ובזיכרון של הפתרון? יש גישה יעילה יותר? מה הייתם משנים לקראת production?",
      },
      {
        title: "רפלקציה אישית",
        durationMinutes: 5,
        detail: "כל אחד/ת כותב/ת לעצמו: מה למדתי? מה הייתי רוצה לתרגל עוד?",
      },
    ],
  },
  "system-design": {
    title: "עיצוב מערכות: מקצר קישורים ו-Rate Limiter",
    format: "מפגש אחד על אחד",
    topic: "מקצר קישורים ו-Rate Limiter",
    steps: [
      {
        title: "קביעת סדר",
        durationMinutes: 2,
        detail: "קבעו מי מתחיל/ה. כל אחד/ת יעבוד על אתגר עיצוב שונה.",
      },
      {
        title: "הצגת הפתרון",
        durationMinutes: 12,
        detail:
          "עצבו מערכת המקצרת כתובות URL ארוכות לכתובות קצרות (כמו bit.ly), כולל הפניה מהירה מהכתובת הקצרה למקורית. הסבירו את תהליך החשיבה שלכם תוך כדי עיצוב הפתרון — דרישות, קנה מידה, ארכיטקטורה ברמה גבוהה.",
        highlightLabel: "שאלה לדוגמה",
      },
      {
        title: "הקשבה ושאלות",
        durationMinutes: 12,
        detail:
          "הקשיבו ושאלו שאלות: איך המערכת מתמודדת עם עומס? מה קורה כשרכיב נכשל? איפה צווארי הבקבוק האפשריים?",
      },
      {
        title: "רישום נפרד",
        durationMinutes: 5,
        detail:
          "המציג/ה כותב/ת רפלקציה אישית. המקשיב/ה כותב/ת משוב על הפתרון שהוצג.",
      },
      {
        title: "החלפת תפקידים ואתגר חדש",
        durationMinutes: 0,
        detail: "עכשיו תורכם — עם אתגר עיצוב שונה מזה שהוצג קודם.",
      },
      {
        title: "הצגת הפתרון (אתגר שני)",
        durationMinutes: 12,
        detail:
          "עצבו rate limiter שמגביל את מספר הבקשות שמשתמש יכול לשלוח למערכת בחלון זמן נתון. הסבירו את תהליך החשיבה שלכם תוך כדי עיצוב הפתרון — דרישות, קנה מידה, ארכיטקטורה ברמה גבוהה.",
        highlightLabel: "שאלה לדוגמה (סבב שני)",
      },
      {
        title: "הקשבה ושאלות (סבב שני)",
        durationMinutes: 12,
        detail:
          "הקשיבו ושאלו שאלות: איך המערכת מתמודדת עם עומס? מה קורה כשרכיב נכשל? איפה צווארי הבקבוק האפשריים?",
      },
      {
        title: "רישום נפרד (סבב שני)",
        durationMinutes: 5,
        detail:
          "המציג/ה כותב/ת רפלקציה אישית. המקשיב/ה כותב/ת משוב על הפתרון שהוצג.",
      },
    ],
  },
};

function formatMinutes(totalMinutes: number) {
  return `${String(totalMinutes).padStart(2, "0")}:00`;
}

function buildTimeline(steps: GuideStepSpec[]) {
  let elapsed = 0;
  const timeline = steps.map((step) => {
    const start = elapsed;
    elapsed += step.durationMinutes;
    return {
      ...step,
      range:
        step.durationMinutes > 0
          ? `${formatMinutes(start)}–${formatMinutes(elapsed)}`
          : formatMinutes(start),
    };
  });
  return { timeline, totalMinutes: elapsed };
}

const formatOptions = [
  {
    title: "פרטנר קבוע",
    body: "תרגול אישי, משוב ממוקד והיכרות מקצועית שנבנית לאורך זמן.",
    icon: <PairIcon />,
    accent: "text-primary",
  },
  {
    title: "קבוצה פרטית קטנה",
    body: "קבוצה של 4–6 אנשים עם ניסיון ומטרות דומים, שמאפשרת ללמוד ממגוון נקודות מבט.",
    icon: <GroupIcon />,
    accent: "text-happy-dark",
  },
];

export function HowItWorks() {
  const [category, setCategory] = useState<CategorySlug>("system-design");
  const guide = SAMPLE_GUIDES[category];
  const categoryLabel = GUIDE_CATEGORIES.find(
    (c) => c.slug === category,
  )!.labelHe;
  const { timeline, totalMinutes } = useMemo(
    () => buildTimeline(guide.steps),
    [guide],
  );

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-warm-surface py-20 sm:py-28"
    >
      <div
        className="marketing-path-grid pointer-events-none absolute inset-x-0 top-0 h-[36rem] opacity-40"
        aria-hidden
      />
      <Container>
        <Reveal>
          <PrimarySectionHeading>איך זה עובד</PrimarySectionHeading>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mx-auto mt-6 max-w-3xl text-center">
            <h2 className="text-4xl leading-[1.08] font-black tracking-[-0.035em] text-balance text-ink sm:text-6xl">
              מוצאים את האנשים הנכונים. מתחילים לתרגל.
            </h2>
          </div>
        </Reveal>

        <div className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          <span
            className="absolute end-[16.66%] start-[16.66%] top-7 hidden h-px bg-primary/25 md:block"
            aria-hidden
          />
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.1} y={18}>
              <article className="group relative md:text-center">
                <div className="flex items-center gap-4 md:flex-col md:gap-5">
                  <span
                    className={cn(
                      "relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-paper shadow-[0_8px_28px_-18px_rgba(35,92,71,0.8)] transition-[transform,background-color,color] duration-300 group-hover:-translate-y-1 group-hover:bg-primary group-hover:text-white",
                      step.accent,
                    )}
                    aria-hidden
                  >
                    {step.icon}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs font-bold md:absolute md:top-5 md:end-6",
                      step.accent,
                    )}
                  >
                    {step.n}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-[1.75] text-muted md:mx-auto md:max-w-sm">
                  {step.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-24 grid items-center gap-12 border-y border-ink/10 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-20">
          <div>
            <Reveal>
              <SubsectionHeading className="text-2xl sm:text-3xl">
                פרטנר קבוע או קבוצה קטנה
              </SubsectionHeading>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-5 max-w-lg text-lg leading-[1.8] text-muted">
                בכל פורמט, המטרה זהה: למצוא אנשים מתאימים ולהפוך את התרגול למשהו
                שקל להתמיד בו.
              </p>
            </Reveal>
          </div>

          <div className="grid gap-0 sm:grid-cols-2">
            {formatOptions.map((option, i) => (
              <Reveal key={option.title} delay={i * 0.1} className="h-full">
                <article className="group relative h-full border-t border-ink/10 py-7 sm:border-t-0 sm:border-s sm:px-8 sm:first:border-s-0">
                  <span
                    className={cn(
                      "flex size-16 items-center justify-center rounded-full bg-white transition-transform duration-300 group-hover:scale-105",
                      option.accent,
                    )}
                    aria-hidden
                  >
                    {option.icon}
                  </span>
                  <h4 className="mt-5 text-xl font-bold text-ink">
                    {option.title}
                  </h4>
                  <p className="mt-3 text-base leading-[1.75] text-muted">
                    {option.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-24 grid items-start gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div className="lg:sticky lg:top-28">
            <Reveal>
              <SubsectionHeading className="text-3xl leading-tight sm:text-4xl">
                נכנסים למפגש בראש שקט
              </SubsectionHeading>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-5 max-w-lg text-lg leading-[1.8] text-muted">
                אל דאגה — לא מגיעים למפגש בלי לדעת למה לצפות. עוד לפני השיעור
                מסכימים יחד מה רוצים לתרגל ובוחרים מערך שיעור מוכן מתוך המאגר
                הכולל מערכי תרגול ושאלות אמיתיות מראיונות, שהועלו על ידי חברי
                הקהילה.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} y={18}>
            <div className="marketing-shadow overflow-hidden rounded-3xl border border-ink/10 bg-white">
              <div
                className="flex items-center gap-2 border-b border-ink/10 bg-paper/80 px-5 py-3"
                aria-hidden
              >
                <span className="size-2.5 rounded-full bg-ink/15" />
                <span className="size-2.5 rounded-full bg-ink/15" />
                <span className="size-2.5 rounded-full bg-happy" />
              </div>
              <div className="border-b border-ink/10 px-5 py-5 sm:px-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-ink">
                    מערך שיעור לדוגמה
                  </h4>
                  <span className="rounded-full bg-mint px-3 py-1 font-mono text-xs font-semibold text-primary">
                    {formatMinutes(totalMinutes)}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="sample-guide-category"
                    className="text-sm text-muted"
                  >
                    קטגוריה:
                  </label>
                  <select
                    id="sample-guide-category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as CategorySlug)
                    }
                    className="min-h-10 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-primary focus:outline-none"
                  >
                    {GUIDE_CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.labelHe}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 border-b border-ink/10 bg-mint/30 sm:grid-cols-4">
                {[
                  { label: "קטגוריה", value: categoryLabel },
                  { label: "פורמט", value: guide.format },
                  { label: "נושא", value: guide.topic },
                  { label: "משך כולל", value: `${totalMinutes} דקות` },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="border-s border-t border-ink/10 px-4 py-4 first:border-s-0 sm:border-t-0"
                  >
                    <p className="font-mono text-xs text-muted">{item.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="px-5 py-6 sm:px-8 sm:py-8">
                <p className="text-sm font-semibold text-muted">
                  חלוקת הזמן במפגש:
                </p>
                <ol className="mt-5 flex flex-col">
                  {timeline.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <div className="flex w-4 shrink-0 flex-col items-center">
                        <span
                          className={cn(
                            "mt-1 size-3 shrink-0 rounded-full ring-4 ring-white",
                            step.highlightLabel ? "bg-primary" : "bg-ink/25",
                          )}
                          aria-hidden
                        />
                        {index < timeline.length - 1 && (
                          <span
                            className="-mt-0.5 w-px flex-1 bg-primary/20"
                            aria-hidden
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-5 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h5 className="text-sm font-bold text-ink">
                            {step.title}
                          </h5>
                          <span
                            dir="ltr"
                            className="shrink-0 font-mono text-xs text-muted"
                          >
                            {step.range}
                          </span>
                        </div>
                        {step.highlightLabel ? (
                          <div className="mt-2 rounded-xl border border-happy/35 bg-happy/10 px-4 py-3">
                            <p className="font-mono text-xs font-semibold text-happy-dark">
                              {step.highlightLabel}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-ink/85">
                              {step.detail}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm leading-relaxed text-muted">
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="border-t border-ink/10 pt-8 lg:col-start-2">
              <p className="text-base leading-relaxed text-muted">
                אם יש חיבור טוב, אפשר להמשיך להיפגש ולהתקדם בקצב שמתאים לכם.
              </p>
              <div className="mt-5">
                <LinkButton href="/register" className="rounded-full">
                  בדקו מי מתאים לכם
                </LinkButton>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function PreferencesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M3 6h5M13.5 6h3.5M3 14h9.5M16 14h1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="6" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle
        cx="14.5"
        cy="14"
        r="2.1"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function MatchSparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle
        cx="7.5"
        cy="11.5"
        r="4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="12.5"
        cy="11.5"
        r="4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10 2.8l.85 1.85 1.85.85-1.85.85-.85 1.85-.85-1.85L7.3 5.5l1.85-.85L10 2.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function StartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.3 7.1l4.7 2.9-4.7 2.9V7.1Z" fill="currentColor" />
    </svg>
  );
}

function PairIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="7" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle
        cx="6.5"
        cy="6.5"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="12"
        cy="7.5"
        r="1.8"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M2.8 14.2c.5-2.3 2-3.6 3.9-3.6s3.4 1.3 3.8 3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M11 14.2c.4-1.8 1.5-2.9 3-2.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
