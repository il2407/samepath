import "server-only";
import { prisma } from "@/shared/db";
import { checkPrivacy } from "@/modules/privacy/context";
import { loadRawProfileForDto } from "@/modules/profiles/dto-loader";
import { toPostMatchDTO, type PostMatchCandidateDTO } from "@/modules/profiles/dto";
import { getRandomGuideForCategory, type PracticeSessionCategorySlug } from "@/modules/guides/service";

export async function createConnectionFromMatch(matchSuggestionId: string, userAId: string, userBId: string) {
  return prisma.connection.create({ data: { matchSuggestionId, userAId, userBId } });
}

export interface ConnectionListItem {
  id: string;
  status: string;
  createdAt: Date;
  otherPartyDisplayName: string;
}

export async function listConnectionsForUser(userId: string): Promise<ConnectionListItem[]> {
  const connections = await prisma.connection.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: "desc" },
  });

  const items: ConnectionListItem[] = [];
  for (const c of connections) {
    const otherUserId = c.userAId === userId ? c.userBId : c.userAId;
    const raw = await loadRawProfileForDto(otherUserId);
    items.push({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      otherPartyDisplayName: raw ? toPostMatchDTO(raw).displayName : "משתמש/ת SamePath",
    });
  }
  return items;
}

export interface SelectedGuideStep {
  id: string;
  order: number;
  title: string;
  prompt: string;
  kind: string;
  role: string;
  durationMinutes: number | null;
}

export interface SelectedGuideDetail {
  id: string;
  title: string;
  purpose: string;
  suggestedDurationMinutes: number;
  category: string | null;
  steps: SelectedGuideStep[];
}

export interface ConnectionDetail {
  id: string;
  status: string;
  createdAt: Date;
  otherParty: PostMatchCandidateDTO;
  messages: { id: string; senderId: string; body: string; createdAt: Date }[];
  meetingStatuses: { id: string; scheduledAt: Date | null; completedAt: Date | null; note: string | null }[];
  selectedGuide: SelectedGuideDetail | null;
}

/** Runs the privacy recheck required before showing a connection, then the post-match DTO. */
export async function getConnectionDetail(userId: string, connectionId: string): Promise<ConnectionDetail | null> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      meetingStatuses: { orderBy: { createdAt: "desc" } },
      selectedGuide: { include: { steps: { orderBy: { order: "asc" } } } },
    },
  });
  if (!connection) return null;
  if (connection.userAId !== userId && connection.userBId !== userId) return null;

  const otherUserId = connection.userAId === userId ? connection.userBId : connection.userAId;

  const privacyResult = await checkPrivacy(userId, otherUserId, { context: "CONNECTION", contextId: connectionId });
  if (!privacyResult.allowed) return null;

  const raw = await loadRawProfileForDto(otherUserId);
  if (!raw) return null;

  return {
    id: connection.id,
    status: connection.status,
    createdAt: connection.createdAt,
    otherParty: toPostMatchDTO(raw),
    messages: connection.messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt })),
    meetingStatuses: connection.meetingStatuses.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduledAt,
      completedAt: m.completedAt,
      note: m.note,
    })),
    selectedGuide: connection.selectedGuide
      ? {
          id: connection.selectedGuide.id,
          title: connection.selectedGuide.title,
          purpose: connection.selectedGuide.purpose,
          suggestedDurationMinutes: connection.selectedGuide.suggestedDurationMinutes,
          category: connection.selectedGuide.category,
          steps: connection.selectedGuide.steps.map((s) => ({
            id: s.id,
            order: s.order,
            title: s.title,
            prompt: s.prompt,
            kind: s.kind,
            role: s.role,
            durationMinutes: s.durationMinutes,
          })),
        }
      : null,
  };
}

function assertParticipant(connection: { userAId: string; userBId: string }, userId: string): void {
  if (connection.userAId !== userId && connection.userBId !== userId) {
    throw new Error("not a participant in this connection");
  }
}

/** Suggests a random guide from a practice-session category for a connection — the "walk in knowing what you'll get" moment. Doesn't persist anything; selectConnectionGuide does that once the pair actually wants it. */
export async function suggestGuideForConnection(userId: string, connectionId: string, category: PracticeSessionCategorySlug) {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  return getRandomGuideForCategory(category);
}

/** Either participant can pick (or change) the suggested structure — it's shared, visible to both, never mandatory. */
export async function selectConnectionGuide(userId: string, connectionId: string, guideId: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);

  const guide = await prisma.sessionGuide.findUnique({ where: { id: guideId }, select: { status: true } });
  if (!guide || guide.status !== "PUBLISHED") throw new Error("guide is not available");

  await prisma.connection.update({ where: { id: connectionId }, data: { selectedGuideId: guideId } });
}

export async function clearConnectionGuide(userId: string, connectionId: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  await prisma.connection.update({ where: { id: connectionId }, data: { selectedGuideId: null } });
}

export async function sendMessage(userId: string, connectionId: string, body: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  if (connection.status !== "ACTIVE") {
    throw new Error("connection is not active");
  }
  await prisma.connectionMessage.create({ data: { connectionId, senderId: userId, body } });
}

export async function markMeeting(
  userId: string,
  connectionId: string,
  input: { scheduledAt?: Date; completedAt?: Date; note?: string },
): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  await prisma.meetingStatus.create({
    data: {
      connectionId,
      scheduledAt: input.scheduledAt,
      completedAt: input.completedAt,
      note: input.note,
      markedByUserId: userId,
    },
  });
}

export async function endConnection(userId: string, connectionId: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  await prisma.connection.update({ where: { id: connectionId }, data: { status: "ENDED", endedAt: new Date() } });
}

export async function blockFromConnection(userId: string, connectionId: string, reason?: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  const otherUserId = connection.userAId === userId ? connection.userBId : connection.userAId;

  await prisma.$transaction([
    prisma.blockedUser.upsert({
      where: { userId_blockedUserId: { userId, blockedUserId: otherUserId } },
      update: {},
      create: { userId, blockedUserId: otherUserId, reason },
    }),
    prisma.connection.update({ where: { id: connectionId }, data: { status: "BLOCKED", endedAt: new Date() } }),
  ]);
}

export async function reportConnection(
  userId: string,
  connectionId: string,
  category: string,
  description: string,
): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  const otherUserId = connection.userAId === userId ? connection.userBId : connection.userAId;

  await prisma.$transaction([
    prisma.report.create({
      data: {
        reporterId: userId,
        reportedUserId: otherUserId,
        connectionId,
        category: category as never,
        description,
      },
    }),
    prisma.connection.update({ where: { id: connectionId }, data: { status: "REPORTED" } }),
  ]);
}
