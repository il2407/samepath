import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./auth-shell.module.css";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <div className={styles.form}>{children}</div>
      <aside className={styles.story}>
        <div className={styles.photo}>
          <Image src="/images/community-abstract.webp" alt="" fill sizes="(max-width: 900px) 1px, 58vw" />
        </div>
        <div className={styles.caption}>
          <span dir="ltr">SAMEPATH / BETTER TOGETHER</span>
          <p>התאמות מקצועיות,<br />בלי חשיפה מיותרת.</p>
          <small>מתחברים עם אנשי מקצוע מהתחום שלכם — בפרטיות מלאה, עד שתחליטו אחרת.</small>
        </div>
      </aside>
    </main>
  );
}
