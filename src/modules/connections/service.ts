import "server-only";
import { prisma } from "@/shared/db";
import { checkPrivacy } from "@/modules/privacy/context";
import { loadRawProfileForDto } from "@/modules/profiles/dto-loader";
import { toPostMatchDTO, type PostMatchCandidateDTO } from "@/modules/profiles/dto";

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

export interface ConnectionDetail {
  id: string;
  status: string;
  createdAt: Date;
  otherParty: PostMatchCandidateDTO;
  messages: { id: string; senderId: string; body: string; createdAt: Date }[];
  meetingStatuses: { id: string; scheduledAt: Date | null; completedAt: Date | null; note: string | null }[];
}

/** Runs the privacy recheck required before showing a connection, then the post-match DTO. */
export async function getConnectionDetail(userId: string, connectionId: string): Promise<ConnectionDetail | null> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: { messages: { orderBy: { createdAt: "asc" } }, meetingStatuses: { orderBy: { createdAt: "desc" } } },
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
  };
}

export async function sendMessage(userId: string, connectionId: string, body: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  if (connection.userAId !== userId && connection.userBId !== userId) {
    throw new Error("not a participant in this connection");
  }
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
  if (connection.userAId !== userId && connection.userBId !== userId) {
    throw new Error("not a participant in this connection");
  }
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
  if (connection.userAId !== userId && connection.userBId !== userId) {
    throw new Error("not a participant in this connection");
  }
  await prisma.connection.update({ where: { id: connectionId }, data: { status: "ENDED", endedAt: new Date() } });
}

export async function blockFromConnection(userId: string, connectionId: string, reason?: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  if (connection.userAId !== userId && connection.userBId !== userId) {
    throw new Error("not a participant in this connection");
  }
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
  if (connection.userAId !== userId && connection.userBId !== userId) {
    throw new Error("not a participant in this connection");
  }
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
