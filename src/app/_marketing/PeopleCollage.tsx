import Image from "next/image";
import styles from "./landing.module.css";

export function PeopleCollage() {
  return (
    <div className={styles.peopleCollage}>
      <div className={styles.photoFrame}>
        <Image src="/images/community-abstract.webp" alt="איור של אנשים עובדים יחד סביב שולחן משותף" fill sizes="(max-width: 1023px) 90vw, 500px" preload />
        <span className={styles.photoIndex} dir="ltr">SAME PATH. SHARED PROGRESS.</span>
      </div>
      <div className={styles.collageNote}>
        <span className={styles.noteIndex} dir="ltr">01 — THE HUMAN PART</span>
        <p>הצעד הבא שלכם.<br />עם מישהו שמבין.</p>
        <svg viewBox="0 0 160 32" fill="none" aria-hidden="true">
          <path d="M3 24c35 0 35-18 70-18s35 18 70 18m-8-8 9 8-10 6" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <div className={styles.smallPhoto}>
        <Image src="/images/conversation-abstract.webp" alt="איור של עמיתים מתייעצים מול מחשב" fill sizes="(max-width: 640px) 40vw, 210px" />
      </div>
      <span className={styles.photoCaption}>לתרגל. לשתף. להתקדם יחד.</span>
    </div>
  );
}
