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
  { slug: "project-presentation", labelHe: "הצגת פרויקט וארכיטקטורה" },
  { slug: "coding", labelHe: "תרגול קוד" },
  { slug: "system-design", labelHe: "תרגול עיצוב מערכות" },
] as const;

export type PracticeSessionCategorySlug = (typeof PRACTICE_SESSION_CATEGORIES)[number]["slug"];

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
