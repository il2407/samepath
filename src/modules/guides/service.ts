import "server-only";
import { prisma } from "@/shared/db";

export async function listPublishedGuides() {
  return prisma.sessionGuide.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { order: "asc" },
  });
}

export async function getPublishedGuide(guideId: string) {
  const guide = await prisma.sessionGuide.findUnique({
    where: { id: guideId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!guide || guide.status !== "PUBLISHED") return null;
  return guide;
}

/** The suggested-session-structure categories surfaced when setting up a connection (spec: structured first-meeting walkthroughs). Slugs, not display labels — display text lives on each guide's own title/purpose. */
export const PRACTICE_SESSION_CATEGORIES = [
  { slug: "intro", labelHe: "פגישת היכרות בווידאו" },
  { slug: "project-presentation", labelHe: "הצגת פרויקט וארכיטקטורה" },
  { slug: "coding", labelHe: "תרגול קוד" },
  { slug: "system-design", labelHe: "תרגול עיצוב מערכות" },
] as const;

export type PracticeSessionCategorySlug = (typeof PRACTICE_SESSION_CATEGORIES)[number]["slug"];

/** Display label for a guide's free-text category — the practice-session slugs get
 * their proper Hebrew name; everything else (the general guides' categories, e.g.
 * "היכרות") is already human-readable and passes through as-is in the caller. */
export const GUIDE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PRACTICE_SESSION_CATEGORIES.map((c) => [c.slug, c.labelHe]),
);

/** The two session shapes guides are browsed by on /app/guides — a guide tagged
 * BOTH fits either, so it's included under both. */
export const GUIDE_SESSION_FORMATS = [
  { value: "ONE_ON_ONE", title: "מפגש אחד על אחד", description: "מערכי מפגש לשיחה בין שניים." },
  { value: "GROUP", title: "מפגש קבוצתי", description: "מערכי מפגש למפגש עם כמה אנשים יחד." },
] as const;

export type GuideSessionFormat = (typeof GUIDE_SESSION_FORMATS)[number]["value"];

/** Picks one published guide at random from a category — the "auto-generated question" behavior for now is variety across a seeded pool rather than real generation; see README assumptions. */
export async function getRandomGuideForCategory(category: string) {
  const candidates = await prisma.sessionGuide.findMany({
    where: { status: "PUBLISHED", category },
    select: { id: true },
  });
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return getPublishedGuide(pick.id);
}

/** Lists every published guide in a category so a connection's participants can browse and pick a specific one, instead of only getting a random pick. */
export async function listGuidesForCategory(category: string) {
  return prisma.sessionGuide.findMany({
    where: { status: "PUBLISHED", category },
    orderBy: { order: "asc" },
    select: { id: true, title: true, purpose: true, suggestedDurationMinutes: true },
  });
}
