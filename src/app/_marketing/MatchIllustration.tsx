"use client";

import { useState, type PointerEvent } from "react";
import styles from "./match-illustration.module.css";

const profiles = [
  { label: "הפרופיל שלכם", number: "01", experience: "3 שנות ניסיון", tags: ["React", "TypeScript"], tone: "self" },
  { label: "במסלול שלכם", number: "02", experience: "4 שנות ניסיון", tags: ["React", "Node.js"], tone: "partner" },
];

const reasons = [
  { title: "תחום וניסיון דומים", detail: "פיתוח תוכנה · 3–4 שנות ניסיון" },
  { title: "אותה מטרת תרגול", detail: "ריאיון טכני ו־System Design" },
  { title: "זמן משותף להיפגש", detail: "שניכם פנויים בשעות הערב" },
];

function tiltCard(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5));
  const y = Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5));
  card.style.setProperty("--tilt-x", `${-y * 10}deg`);
  card.style.setProperty("--tilt-y", `${x * 12}deg`);
}

function resetCard(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--tilt-x");
  event.currentTarget.style.removeProperty("--tilt-y");
}

export function MatchIllustration() {
  const [replay, setReplay] = useState(0);

  return (
    <section className={styles.match} aria-label="כך נראית התאמה לדוגמה">
      <div className={styles.caption}>
        <span>שני אנשים. הצעד הבא, ביחד.</span>
        <span className={styles.example}>התאמה לדוגמה</span>
      </div>
      <div key={replay}>
        <div className={styles.stage}>
          <div className={styles.orbit} aria-hidden="true" />
          <svg className={styles.path} viewBox="0 0 440 360" fill="none" aria-hidden="true">
            <path d="M310 100 C440 170 65 150 140 275" pathLength="1" />
          </svg>
          {profiles.map((profile) => (
            <article key={profile.number} className={`${styles.card} ${styles[profile.tone]}`} aria-label={profile.label}
              onPointerMove={tiltCard}
              onPointerLeave={resetCard}
              onPointerCancel={resetCard}
            >
              <div className={styles.cardTop}>
                <span>{profile.label}</span>
                <span className={styles.number}>{profile.number}</span>
              </div>
              <div className={styles.identity}>
                <div className={styles.avatar} aria-hidden="true">
                  <svg viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="14" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 35c0-8 5-12 13-12s13 4 13 12" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
                <div>
                  <h3 dir="ltr">Software Engineer</h3>
                  <p>{profile.experience}</p>
                </div>
              </div>
              <div className={styles.tags}>
                {profile.tags.map((tag) => <span key={tag} dir="ltr">{tag}</span>)}
                <span>תרגול ריאיון טכני</span>
              </div>
              <div className={styles.cardFooter}><span aria-hidden="true">◷</span> פנויים בערב <span>·</span> פרופיל אנונימי</div>
            </article>
          ))}
          <div className={styles.connection}>
            <svg viewBox="0 0 28 20" fill="none" aria-hidden="true">
              <rect x="1" y="4" width="17" height="12" rx="6" stroke="currentColor" strokeWidth="1.5" />
              <rect x="10" y="4" width="17" height="12" rx="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>יש לכם בסיס לחיבור</span>
          </div>
          <span className={styles.marginNote} aria-hidden="true">נפגשים באותו מסלול ↗</span>
        </div>
        <div className={styles.reasons}>
          <div className={styles.reasonHeading}>
            <h3>למה ההתאמה מוצלחת?</h3>
            <span aria-hidden="true">↙</span>
          </div>
          <ul>
            {reasons.map((reason) => (
              <li key={reason.title}>
                <span className={styles.check} aria-hidden="true">✓</span>
                <div><strong>{reason.title}</strong><p>{reason.detail}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.bottom}>
        <p>פרטים מזהים נחשפים רק כשיש עניין הדדי.</p>
        <button type="button" onClick={() => setReplay((value) => value + 1)} aria-label="הצגת אנימציית ההתאמה שוב">
          <span aria-hidden="true">↻</span> שוב את החיבור
        </button>
      </div>
    </section>
  );
}
