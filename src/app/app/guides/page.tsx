import { ContentProposal } from "@/modules/connections/ContentProposal";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/modules/auth/session";
import { listPublishedGuides } from "@/modules/guides/service";
import { getLessonTemplate, lessonTemplates } from "@/modules/guides/catalog";
import { LessonWorkspace } from "@/modules/guides/LessonWorkspace";
import styles from "@/modules/guides/lessons.module.css";
import { Container } from "@/shared/ui/Container";
import { FlowNav } from "../FlowNav";

export const metadata: Metadata = { title: "מערכי מפגש — SamePath" };

export default async function GuidesPage({
  searchParams,
}: PageProps<"/app/guides">) {
  const user = await requireUser();
  const query = await searchParams;
  const connectionId = typeof query.connection === "string" ? query.connection : undefined;
  const contextQuery = connectionId ? `&connection=${encodeURIComponent(connectionId)}` : "";
  const back = connectionId ? { href: `/app/connections/${encodeURIComponent(connectionId)}`, label: "חזרה לחיבור" } : { href: "/app/guides", label: "חזרה למאגר התוכן" };
  const category =
    typeof query.category === "string" ? query.category : undefined;
  const questionId =
    typeof query.question === "string" ? query.question : undefined;
  const template = getLessonTemplate(category);

  if (template)
    return (
      <Container className="max-w-5xl py-10">
        <FlowNav prev={back} />
        <ContentProposal userId={user.id} contentKey={`template:${template.slug}`} connectionId={connectionId} />
        <LessonWorkspace template={template} questionId={questionId} />
      </Container>
    );

  const guides = await listPublishedGuides();
  return (
    <Container className="max-w-5xl py-10">
      <FlowNav prev={connectionId ? back : undefined} />
      <header className={styles.header}>
        <p className={styles.eyebrow}>מתרגלים יחד, מגיעים מוכנים</p>
        <h1>מערכי מפגש ושאלות מראיונות</h1>
        <p>
          בחרו מה לתרגל. המבנה כבר מוכן — בוחרים שאלה, מחלקים תפקידים ומתחילים.
        </p>
        <div className={styles.meta}>
          <span>4 סוגי תרגול</span>
          <span>מבנה קבוע לכל סוג</span>
          <span>שאלות המשך למראיין/ת</span>
        </div>
      </header>
      <Link href={`/app/interviews${connectionId ? `?connection=${encodeURIComponent(connectionId)}` : ""}`} className="mb-6 inline-flex min-h-11 items-center text-sm font-medium text-primary-dark underline">לשאלות מראיונות מהקהילה ←</Link>
      <div className={styles.cards}>
        {lessonTemplates.map((item) => (
          <Link
            key={item.slug}
            href={`/app/guides?category=${item.slug}${contextQuery}`}
            className={styles.card}
          >
            <span className={styles.eyebrow}>{item.english}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <div className={styles.cardFooter}>
              <span>
                {item.stages.reduce((sum, stage) => sum + stage.minutes, 0)}{" "}
                דקות לסבב · {item.questions.length} שאלות
              </span>
              <span>למערך המפגש ←</span>
            </div>
          </Link>
        ))}
      </div>
      {guides.length > 0 && (
        <details className={styles.additional} open={!!category}>
          <summary>מערכים נוספים · היכרות, ליווי ותכנים מהמאגר</summary>
          <p>כאן זמינים גם מערכים קודמים ותכנים נוספים שפורסמו.</p>
          {guides
            .filter((guide) => !category || guide.category === category)
            .map((guide) => (
              <Link key={guide.id} href={`/app/guides/${guide.id}${connectionId ? `?connection=${encodeURIComponent(connectionId)}` : ""}`}>
                {guide.title} · {guide.suggestedDurationMinutes} דקות
              </Link>
            ))}
          {category && !guides.some((guide) => guide.category === category) && (
            <p>
              לא נמצאו מערכים בקטגוריה הזו. אפשר לבחור אחד מסוגי התרגול למעלה.
            </p>
          )}
        </details>
      )}
    </Container>
  );
}
