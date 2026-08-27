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
