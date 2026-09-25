import "server-only";
import { prisma } from "@/shared/db";
import { getLessonTemplate } from "@/modules/guides/catalog";
import { getPublishedGuide } from "@/modules/guides/service";
import { getPublicExperienceDetail } from "@/modules/interviews/library";
import { checkPrivacy } from "@/modules/privacy/context";
import type { PracticeContent, SharedPractice } from "./content";

export class ContentSelectionError extends Error {}

export async function resolvePracticeContent(
  key: string | null,
): Promise<PracticeContent | null> {
  if (!key) return null;
  const [kind, id] = key.split(":");
  if (kind === "template") {
    const template = getLessonTemplate(id);
    return template
      ? {
          key,
          title: template.title,
          purpose: template.description,
          minutes: template.stages.reduce(
            (sum, stage) => sum + stage.minutes,
            0,
          ),
          level: [...new Set(template.questions.map((q) => q.level))].join(
            " / ",
          ),
          href: `/app/guides?category=${encodeURIComponent(template.slug)}`,
        }
      : null;
  }
  if (kind === "guide") {
    const guide = await getPublishedGuide(id);
    return guide
      ? {
          key,
          title: guide.title,
          purpose: guide.purpose,
          minutes: guide.suggestedDurationMinutes,
          href: `/app/guides/${guide.id}`,
        }
      : null;
  }
  if (kind === "interview") {
    const experience = await getPublicExperienceDetail(id);
    return experience?.questions.length
      ? {
          key,
          title: `שאלות מראיונות — ${experience.companyName}`,
          purpose: [
            experience.targetRole,
            `${experience.questions.length} שאלות לתרגול משותף`,
          ]
            .filter(Boolean)
            .join(" · "),
          level: experience.seniorityBand ?? undefined,
          href: `/app/interviews/experiences/${experience.id}`,
        }
      : null;
  }
  return null;
}

type PracticeRecord = {
  pendingContentKey: string | null;
  agreedContentKey: string | null;
  contentProposedBy: string | null;
  contentRevision: number;
};
export async function loadSharedPractice(
  connection: PracticeRecord,
): Promise<SharedPractice> {
  const [pending, agreed] = await Promise.all([
    resolvePracticeContent(connection.pendingContentKey),
    resolvePracticeContent(connection.agreedContentKey),
  ]);
  return {
    pending,
    agreed,
    proposedBy: connection.contentProposedBy,
    revision: connection.contentRevision,
  };
}

export async function changePractice(
  userId: string,
  connectionId: string,
  revision: number,
  key?: string,
) {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });
  if (
    !connection ||
    ![connection.userAId, connection.userBId].includes(userId) ||
    connection.status !== "ACTIVE"
  )
    throw new ContentSelectionError("החיבור אינו זמין לפעולה");
  const otherId =
    connection.userAId === userId ? connection.userBId : connection.userAId;
  if (
    !(
      await checkPrivacy(userId, otherId, {
        context: "CONNECTION",
        contextId: connectionId,
      })
    ).allowed
  )
    throw new ContentSelectionError("החיבור אינו זמין לפעולה");
  if (connection.contentRevision !== revision)
    throw new ContentSelectionError(
      "התוכן עודכן בינתיים. רעננו את החיבור ובדקו את ההצעה העדכנית",
    );
  if (
    key === undefined &&
    (!connection.pendingContentKey || connection.contentProposedBy === userId)
  )
    throw new ContentSelectionError("רק הצד השני יכול לאשר את ההצעה");
  const selectedKey = key ?? connection.pendingContentKey;
  if (!selectedKey || !(await resolvePracticeContent(selectedKey)))
    throw new ContentSelectionError(
      "התוכן אינו זמין כרגע. אפשר לבחור תוכן אחר",
    );
  if (
    key &&
    (key === connection.pendingContentKey ||
      key === connection.agreedContentKey)
  )
    throw new ContentSelectionError("התוכן כבר נבחר. אפשר לחזור לחיבור");
  // Compare-and-swap keeps a stale tab from approving a replacement or overwriting a newer proposal.
  const result = await prisma.connection.updateMany({
    where: { id: connectionId, status: "ACTIVE", contentRevision: revision },
    data: key
      ? {
          pendingContentKey: key,
          contentProposedBy: userId,
          contentRevision: { increment: 1 },
        }
      : {
          agreedContentKey: selectedKey,
          pendingContentKey: null,
          contentProposedBy: null,
          contentRevision: { increment: 1 },
        },
  });
  if (result.count !== 1)
    throw new ContentSelectionError(
      "התוכן עודכן בינתיים. רעננו את החיבור ובדקו את ההצעה העדכנית",
    );
}
