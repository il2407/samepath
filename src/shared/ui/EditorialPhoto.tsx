import Image from "next/image";
import styles from "./editorial.module.css";

const photos = {
  community: "/images/community-abstract.webp",
  conversation: "/images/conversation-abstract.webp",
  notebook: "/images/notebook-abstract.webp",
} as const;

/** Editorial imagery only: never represents a member or an actual platform event. */
export function EditorialPhoto({ scene = "community", label, caption, compact = false }: {
  scene?: keyof typeof photos;
  label: string;
  caption: string;
  compact?: boolean;
}) {
  return (
    <aside className={`${styles.banner} ${compact ? styles.compact : ""}`}>
      <div className={styles.copy}>
        <span className={styles.label}>{label}</span>
        <p>{caption}</p>
        <svg className={styles.path} viewBox="0 0 200 32" fill="none" aria-hidden="true">
          <path d="M2 25C40 25 35 5 70 5s35 20 65 20 32-20 63-20" stroke="currentColor" strokeWidth="2" />
          <circle cx="198" cy="5" r="3" fill="currentColor" />
        </svg>
      </div>
      <div className={styles.photo}>
        <Image src={photos[scene]} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 55vw, 640px" />
      </div>
    </aside>
  );
}
