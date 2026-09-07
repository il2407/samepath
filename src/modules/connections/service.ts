import "server-only";
import { prisma } from "@/shared/db";
import { checkPrivacy } from "@/modules/privacy/context";
import { loadRawProfileForDto } from "@/modules/profiles/dto-loader";
import { toPostMatchDTO, type PostMatchCandidateDTO } from "@/modules/profiles/dto";
import { generateFriendlyNickname } from "@/modules/profiles/nickname";
import { getRandomGuideForCategory, type PracticeSessionCategorySlug } from "@/modules/guides/service";
import { getStorage } from "@/shared/storage";
import type { ConnectionReason } from "@/generated/prisma/client";

/**
 * Reads the actual photo bytes back out of storage as a data URL — never
 * exposed through dto.ts (which stays a pure, DB/storage-free layer): this
 * is the one place allowed to do it, and only after the caller has already
 * rechecked privacy and confirmed the connection is real and mutual.
 */
async function loadPhotoDataUrl(disclosure: { sharePhotoPostMatch: boolean; photoStorageKey: string | null; photoMimeType: string | null } | null): Promise<string | null> {
  if (!disclosure?.sharePhotoPostMatch || !disclosure.photoStorageKey) return null;
  try {
    const buffer = await getStorage().get(disclosure.photoStorageKey);
    return `data:${disclosure.photoMimeType ?? "image/jpeg"};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error("failed to load profile photo for connection", error);
    return null;
  }
}

export async function createConnectionFromMatch(matchSuggestionId: string, userAId: string, userBId: string) {
  return prisma.connection.create({ data: { matchSuggestionId, userAId, userBId } });
}

/**
 * The name shown for the other party: their real full name once they've
 * opted into shareFullNamePostMatch, otherwise the same system-generated
 * anonymous nickname the match suggestion card showed before the match —
 * seeded from matchSuggestionId, the stable id both phases share, so the
 * identity a user saw pre-match stays consistent into the connection instead
 * of jumping to a new random nickname.
 */
function resolveDisplayName(fullName: string | null, matchSuggestionId: string): string {
  return fullName || generateFriendlyNickname(matchSuggestionId);
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
      otherPartyDisplayName: resolveDisplayName(raw ? toPostMatchDTO(raw).fullName : null, c.matchSuggestionId),
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
  otherPartyDisplayName: string;
  /** Only set when the other party opted into sharePhotoPostMatch and actually uploaded a photo — otherwise the UI falls back to the initials avatar. */
  otherPartyPhotoDataUrl: string | null;
  messages: { id: string; senderId: string; body: string; createdAt: Date }[];
  meetingStatuses: { id: string; scheduledAt: Date | null; completedAt: Date | null; note: string | null }[];
  selectedGuide: SelectedGuideDetail | null;
  /** What each side wants out of this specific connection's session(s) — independent, no agreement required. */
  mySessionTypes: string[];
  otherPartySessionTypes: string[];
}

/** Runs the privacy recheck required before showing a connection, then the post-match DTO. */
export async function getConnectionDetail(userId: string, connectionId: string): Promise<ConnectionDetail | null> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      meetingStatuses: { orderBy: { createdAt: "desc" } },
      selectedGuide: { include: { steps: { orderBy: { order: "asc" } } } },
      sessionTypeSelections: true,
    },
  });
  if (!connection) return null;
  if (connection.userAId !== userId && connection.userBId !== userId) return null;

  const otherUserId = connection.userAId === userId ? connection.userBId : connection.userAId;

  const privacyResult = await checkPrivacy(userId, otherUserId, { context: "CONNECTION", contextId: connectionId });
  if (!privacyResult.allowed) return null;

  const raw = await loadRawProfileForDto(otherUserId);
  if (!raw) return null;

  const otherParty = toPostMatchDTO(raw);

  return {
    id: connection.id,
    status: connection.status,
    createdAt: connection.createdAt,
    otherParty,
    otherPartyDisplayName: resolveDisplayName(otherParty.fullName, connection.matchSuggestionId),
    otherPartyPhotoDataUrl: await loadPhotoDataUrl(raw.disclosurePreference),
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
    mySessionTypes: connection.sessionTypeSelections.find((s) => s.userId === userId)?.sessionTypes ?? [],
    otherPartySessionTypes: connection.sessionTypeSelections.find((s) => s.userId === otherUserId)?.sessionTypes ?? [],
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

/** Each participant independently records what they want out of this specific connection's session(s); visible to the other side, no agreement required — same advisory model as selectConnectionGuide. */
export async function setMySessionTypes(userId: string, connectionId: string, sessionTypes: ConnectionReason[]): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  await prisma.connectionSessionTypeSelection.upsert({
    where: { connectionId_userId: { connectionId, userId } },
    update: { sessionTypes },
    create: { connectionId, userId, sessionTypes },
  });
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
