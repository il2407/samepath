"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  interviewSources,
  type InterviewQuestion,
  type LessonTemplate,
} from "./catalog";
import styles from "./lessons.module.css";

function InterviewerNotes({ question }: { question: InterviewQuestion }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.interviewer}>
      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={open}
        aria-controls="interviewer-notes"
        onClick={() => setOpen(!open)}
      >
        <span>למראיין/ת · שאלות המשך ונקודות לבדיקה</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      <p className={styles.note}>
        פתחו במסך של המראיין/ת. החלק הזה כולל רמזים וכיווני פתרון.
      </p>
      {open && (
        <div id="interviewer-notes" className={styles.notes}>
          <section>
            <h4>תשובות לשאלות הבהרה</h4>
            <p>{question.clarification}</p>
          </section>
          {[
            { title: "הכוונה · אם נתקעים", items: question.hints },
            { title: "אתגר · כשיש כיוון טוב", items: question.challenges },
            { title: "מקרי קצה · בדיקת הנחות", items: question.edgeCases },
            { title: "למה להקשיב בתשובה", items: question.signals },
          ].map((group) => (
            <section key={group.title}>
              <h4>{group.title}</h4>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
          <p className={styles.note}>
            בחרו שאלת המשך אחת בכל פעם, ותנו זמן לחשוב. המטרה היא לבדוק חשיבה
            והנחות, לא להפתיע בניסוח מטעה.
          </p>
        </div>
      )}
    </div>
  );
}

export function LessonWorkspace({
  template,
  questionId,
}: {
  template: LessonTemplate;
  questionId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const question =
    template.questions.find((item) => item.id === questionId) ??
    template.questions[0];
  const minutes = template.stages.reduce(
    (sum, stage) => sum + stage.minutes,
    0,
  );

  function selectQuestion(id: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("category", template.slug);
    query.set("question", id);
    query.delete("format");
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <div className={styles.workspace}>
      <Link href={searchParams.get("connection") ? `/app/guides?connection=${encodeURIComponent(searchParams.get("connection")!)}` : "/app/guides"} className={styles.back}>
        ← כל מערכי המפגש
      </Link>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{template.english}</p>
        <h1>{template.title}</h1>
        <p>{template.description}</p>
        <div className={styles.meta}>
          <span>{minutes} דקות לסבב</span>
          <span>מראיין/ת + מרואיין/ת</span>
          <span>מבנה קבוע, שאלות מתחלפות</span>
        </div>
      </header>
      <div className={styles.layout}>
        <aside className={styles.overview} aria-label="מבנה המפגש">
          <h2>מהלך המפגש</h2>
          <ol>
            {template.stages.map((stage, index) => (
              <li key={stage.title}>
                <a href={`#stage-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    {stage.title}
                    <small>{stage.minutes} דקות</small>
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <p>
            רוצים ששניכם תתרגלו? החליפו תפקידים ושאלה לסבב נוסף של {minutes}{" "}
            דקות.
          </p>
          <p>
            בקבוצה: אחד/ת מראיין/ת, אחד/ת עונה והשאר מתבוננים ונותנים משוב בסוף.
          </p>
        </aside>
        <div className={styles.stages}>
          <div className={styles.preparation}>
            <h2>לפני שמתחילים</h2>
            <p>{template.preparation}</p>
          </div>
          {template.stages.map((stage, index) => (
            <section
              id={`stage-${index}`}
              key={stage.title}
              className={styles.stage}
            >
              <div className={styles.stageHeading}>
                <span className={styles.number}>{index + 1}</span>
                <h2>{stage.title}</h2>
                <span className={styles.duration}>{stage.minutes} דקות</span>
              </div>
              <p>{stage.instruction}</p>
              {stage.question && (
                <div className={styles.exercise}>
                  <div className={styles.picker}>
                    <label htmlFor="lesson-question">השאלה לתרגול</label>
                    <select
                      id="lesson-question"
                      value={question.id}
                      onChange={(event) => selectQuestion(event.target.value)}
                    >
                      {template.questions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} · {item.level}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={styles.note}>
                    בחירת השאלה נשמרת בקישור — אפשר לשלוח אותו לשותף/ה. החלפת
                    שאלה לא משנה את מבנה המפגש.
                  </p>
                  <div className={styles.question} aria-live="polite">
                    <span className={styles.level}>{question.level}</span>
                    <h3>{question.title}</h3>
                    <p dir="auto">{question.prompt}</p>
                  </div>
                  <InterviewerNotes key={question.id} question={question} />
                </div>
              )}
              {index === 2 && (
                <ul className={styles.feedback}>
                  {template.feedback.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <details className={styles.sources}>
            <summary>על התוכן ומקורות ההכנה</summary>
            <p>
              אלו שאלות סימולציה מקוריות, לא דיווח על שאלות שנשאלו בחברה מסוימת.
              המיומנויות נבחרו בהתאם להנחיות הכנה ציבוריות; הזמנים והאילוצים הם
              הצעה לתרגול משותף.
            </p>
            {interviewSources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title} ↗
              </a>
            ))}
          </details>
        </div>
      </div>
    </div>
  );
}
