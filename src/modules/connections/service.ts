import "server-only";
import { loadSharedPractice } from "./content-service";
import type { SharedPractice } from "./content";
import { prisma } from "@/shared/db";
import { checkPrivacy } from "@/modules/privacy/context";
import { loadRawProfileForDto } from "@/modules/profiles/dto-loader";
import { toPostMatchDTO, type PostMatchCandidateDTO } from "@/modules/profiles/dto";
import { generateFriendlyNickname } from "@/modules/profiles/nickname";
import { getRandomGuideForCategory, listGuidesForCategory, type PracticeSessionCategorySlug } from "@/modules/guides/service";
import { getStorage } from "@/shared/storage";
import { validateMeetLink } from "@/modules/connections/meeting-link";
import { getGoogleMeetClient } from "@/modules/auth/google-meet";
import { decryptSecret, encryptSecret } from "@/modules/auth/crypto";
import { Prisma, type ConnectionReason, type IntroMeetingStance } from "@/generated/prisma/client";
import { logger } from "@/shared/logger";

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
    logger.error("failed to load profile photo for connection", { error });
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
  /**
   * The candidate's real full name, company, and LinkedIn URL — shown
   * directly on the connections list (not just one click away in the
   * detail view) so both sides can immediately assess who they matched
   * with, per the mutual-and-complete-on-approval disclosure rule. Null
   * when the candidate never entered that field; the UI must say so
   * explicitly rather than leaving it blank or reusing the anonymous
   * nickname.
   */
  otherPartyFullName: string | null;
  otherPartyCompany: string | null;
  otherPartyLinkedInUrl: string | null;
  otherPartyPhotoDataUrl?: string | null;
  otherPartyRole?: string | null;
  practice?: SharedPractice;
}

export async function listConnectionsForUser(userId: string): Promise<ConnectionListItem[]> {
  const connections = await prisma.connection.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: "desc" },
  });

  const items: ConnectionListItem[] = [];
  for (const c of connections) {
    const otherUserId = c.userAId === userId ? c.userBId : c.userAId;
    if (!(await checkPrivacy(userId, otherUserId, { context: "CONNECTION", contextId: c.id })).allowed) continue;
    const raw = await loadRawProfileForDto(otherUserId);
    const dto = raw ? toPostMatchDTO(raw) : null;
    items.push({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      otherPartyDisplayName: resolveDisplayName(dto?.fullName ?? null, c.matchSuggestionId),
      otherPartyFullName: dto?.fullName ?? null,
      otherPartyCompany: dto?.company ?? null,
      otherPartyLinkedInUrl: dto?.linkedInUrl ?? null,
      otherPartyPhotoDataUrl: await loadPhotoDataUrl(raw?.disclosurePreference ?? null),
      otherPartyRole: dto?.currentRoleTitle || dto?.professionalField || null,
      practice: await loadSharedPractice(c),
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
  practice?: SharedPractice;
  id: string;
  status: string;
  createdAt: Date;
  otherParty: PostMatchCandidateDTO;
  otherPartyDisplayName: string;
  /** Only set when the other party opted into sharePhotoPostMatch and actually uploaded a photo — otherwise the UI falls back to the initials avatar. */
  otherPartyPhotoDataUrl: string | null;
  /** Count of the other party's own PUBLISHED interview experience write-ups (see InterviewExperience.status) — a trust signal shown on the contact card, same spirit as cvVerified. Zero renders as no badge, never a "0 questions" label. */
  otherPartyPublishedInterviewCount: number;
  messages: { id: string; senderId: string; body: string; createdAt: Date }[];
  meetingStatuses: { id: string; scheduledAt: Date | null; completedAt: Date | null; note: string | null }[];
  /** The *viewer's own* configured timezone (ConnectionPreference.timezone, from onboarding) — used only for display-side formatting of a meeting proposal's scheduledAt, never for cross-timezone conversion. Reading one's own preference here has no privacy implication (it's not the other party's data). */
  myTimezone: string;
  selectedGuide: SelectedGuideDetail | null;
  /** What each side wants out of this specific connection's session(s) — independent, no agreement required. */
  mySessionTypes: string[];
  otherPartySessionTypes: string[];
  /** Each side's independent, informational-only stance on whether a video intro meeting is a prerequisite for them — null means no stance declared yet. Never technically enforced; see IntroRequirementBanner in ConnectionRoom.tsx. */
  myIntroStance: IntroMeetingStance | null;
  otherPartyIntroStance: IntroMeetingStance | null;
  /** The most recently attached/generated Google Meet link for this connection, if any — the latest MeetingProposal row's meetLink, regardless of that row's negotiation status (see getOrCreateMeetLinkHolderProposal below). Null until either party attaches or generates one. */
  meetLink: string | null;
}

export interface MeetingProposalDetail {
  id: string;
  status: string;
  proposedByUserId: string;
  respondedByUserId: string | null;
  respondedAt: Date | null;
  sessionType: string | null;
  meetLink: string | null;
  scheduledAt: Date | null;
  previousProposalId: string | null;
  createdAt: Date;
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
      introRequirements: true,
      meetingProposals: { orderBy: { createdAt: "desc" }, take: 1 },
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

  const otherPartyPublishedInterviewCount = await prisma.interviewExperience.count({
    where: { authorId: otherUserId, status: "PUBLISHED" },
  });

  const myProfile = await prisma.professionalProfile.findUnique({
    where: { userId },
    select: { connectionPreference: { select: { timezone: true } } },
  });

  return {
    practice: await loadSharedPractice(connection),
    id: connection.id,
    status: connection.status,
    createdAt: connection.createdAt,
    otherParty,
    otherPartyDisplayName: resolveDisplayName(otherParty.fullName, connection.matchSuggestionId),
    otherPartyPhotoDataUrl: await loadPhotoDataUrl(raw.disclosurePreference),
    otherPartyPublishedInterviewCount,
    messages: connection.messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt })),
    meetingStatuses: connection.meetingStatuses.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduledAt,
      completedAt: m.completedAt,
      note: m.note,
    })),
    myTimezone: myProfile?.connectionPreference?.timezone ?? "Asia/Jerusalem",
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
    myIntroStance: connection.introRequirements.find((r) => r.userId === userId)?.stance ?? null,
    otherPartyIntroStance: connection.introRequirements.find((r) => r.userId === otherUserId)?.stance ?? null,
    meetLink: connection.meetingProposals[0]?.meetLink ?? null,
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

/** Lists every published guide in a category so a connection's participants can browse and pick a specific one, instead of only getting a random pick. */
export async function listGuideOptionsForConnection(userId: string, connectionId: string, category: PracticeSessionCategorySlug) {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  return listGuidesForCategory(category);
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

/** Each participant independently declares whether a video intro meeting is, for them, a prerequisite before continuing. Purely informational — visible to the other side, never technically enforced (no locking, no status change); a mismatch is surfaced as a UI banner only. */
export async function setMyIntroRequirement(userId: string, connectionId: string, stance: IntroMeetingStance): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  await prisma.connectionIntroRequirement.upsert({
    where: { connectionId_userId: { connectionId, userId } },
    update: { stance },
    create: { connectionId, userId, stance },
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

// ---------------------------------------------------------------------------
// Meeting proposals (WS7, backlog item 14) — the propose/accept/decline/
// counter-propose negotiation for actually scheduling a meeting, distinct
// from markMeeting/MeetingStatus below (an append-only "it happened" log
// filled in afterward). See prisma/schema.prisma's MeetingProposalStatus doc
// comment for the exact state-machine semantics this code implements.
//
// The full propose/accept/decline/counter-propose negotiation UI has been
// removed from the connection room (meeting coordination now happens over
// free-form chat instead) — but the underlying MeetingProposal table, its
// state machine, and every function below stay in place: they're still the
// holder of the connection's Google Meet link (see
// getOrCreateMeetLinkHolderProposal below), and getMeetingProposals/
// propose/accept/decline/counterPropose remain available server-side for
// any caller that still needs the full negotiation history. getConnectionDetail
// above includes only the single latest MeetingProposal row (for its
// `meetLink` field) — getMeetingProposals here is still the way to load the
// full history when needed.
// ---------------------------------------------------------------------------

/**
 * Thrown only for deliberate, expected business-rule rejections in the
 * meeting-proposal flow (duplicate open proposal, self-accept, invalid meet
 * link, etc.) — each carries a clean, already-Hebrew, user-safe message.
 * actions.ts's meetingProposalErrorMessage() only ever surfaces `.message`
 * for this specific type; any other thrown error (a raw Prisma/db error, for
 * instance) falls back to a generic message instead, so an internal error
 * (e.g. a pre-migration "relation does not exist") never leaks verbatim to
 * the UI — see the WS7 final report for how this was actually caught (a raw
 * Prisma error's full internal message, including bundler-mangled module
 * paths, was rendering directly in the meeting-proposal panel before this
 * fix).
 */
export class MeetingProposalError extends Error {}

/** Loads the full propose/accept/decline/counter-propose history for a connection, newest first — proposals[0], if present, is always the current/latest negotiation state. Requires its own migration (see the note above); do not call from any path that must keep working before that lands. */
export async function getMeetingProposals(userId: string, connectionId: string): Promise<MeetingProposalDetail[]> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);

  const proposals = await prisma.meetingProposal.findMany({
    where: { connectionId },
    orderBy: { createdAt: "desc" },
  });

  return proposals.map((p) => ({
    id: p.id,
    status: p.status,
    proposedByUserId: p.proposedByUserId,
    respondedByUserId: p.respondedByUserId,
    respondedAt: p.respondedAt,
    sessionType: p.sessionType,
    meetLink: p.meetLink,
    scheduledAt: p.scheduledAt,
    previousProposalId: p.previousProposalId,
    createdAt: p.createdAt,
  }));
}

/** PROPOSED is the only "open" (awaiting response) status — see the schema doc comment on MeetingProposalStatus. */
function isOpenProposalStatus(status: string): boolean {
  return status === "PROPOSED";
}

/** Validates+normalizes an optional meet-link input: undefined/blank -> null; anything else must pass validateMeetLink or this throws with the Hebrew validation error, surfaced to the caller (actions.ts) as the action's error message. */
function normalizeMeetLink(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null || !raw.trim()) return null;
  const result = validateMeetLink(raw);
  if (!result.ok) throw new MeetingProposalError(result.error);
  return result.url;
}

async function getLatestProposal(connectionId: string) {
  return prisma.meetingProposal.findFirst({ where: { connectionId }, orderBy: { createdAt: "desc" } });
}

/**
 * The simplified connection room has no proposal-negotiation UI, but
 * attach/generate-meet-link still write onto a MeetingProposal row (its
 * `meetLink` column). This returns the connection's existing proposal if one
 * already exists (from prior negotiation-flow use, or a prior Meet-link
 * action), or creates a minimal placeholder row to hold the link if none
 * exists yet. Uses a serializable transaction + retry to stay race-safe
 * against concurrent double-clicks of "create meet link" with no existing
 * proposal — there's no unique constraint on connectionId (would break
 * multi-proposal negotiation), so the transaction isolation level is what
 * prevents two concurrent calls from each creating their own row.
 */
async function getOrCreateMeetLinkHolderProposal(userId: string, connectionId: string) {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);

  const existing = await getLatestProposal(connectionId);
  if (existing) return existing;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const stillNone = await tx.meetingProposal.findFirst({ where: { connectionId } });
          if (stillNone) return stillNone;
          return tx.meetingProposal.create({ data: { connectionId, proposedByUserId: userId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt === 0) continue;
      throw error;
    }
  }
  throw new Error("unreachable");
}

/** Attaches a manually-pasted Google Meet link to a connection with no proposal-negotiation UI — gets or creates the connection's meet-link-holder proposal, then delegates to attachMeetLink's existing validation/permission logic. */
export async function attachMeetLinkForConnection(userId: string, connectionId: string, meetLink: string): Promise<void> {
  const proposal = await getOrCreateMeetLinkHolderProposal(userId, connectionId);
  await attachMeetLink(userId, connectionId, proposal.id, meetLink);
}

/** Generates a real Google Meet link (Meet API v2) for a connection with no proposal-negotiation UI — gets or creates the connection's meet-link-holder proposal, then delegates to generateMeetLink's existing grant/API logic. */
export async function generateMeetLinkForConnection(userId: string, connectionId: string): Promise<void> {
  const proposal = await getOrCreateMeetLinkHolderProposal(userId, connectionId);
  await generateMeetLink(userId, connectionId, proposal.id);
}

export interface ProposeMeetingInput {
  sessionType?: ConnectionReason;
  meetLink?: string;
  scheduledAt?: Date;
}

/**
 * Opens a new meeting negotiation. Refuses to run if the connection already
 * has an open (PROPOSED) proposal — item 14.7's "duplicate open proposal"
 * guard, enforced here at the service layer (see the WS7 final report's
 * "known limitations" for why this isn't also a DB constraint). The correct
 * next step once one is open is to respond to it (accept/decline/counter-
 * propose), not to open a second, independent one.
 */
export async function proposeMeeting(userId: string, connectionId: string, input: ProposeMeetingInput): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  if (connection.status !== "ACTIVE") throw new MeetingProposalError("החיבור אינו פעיל");

  const latest = await getLatestProposal(connectionId);
  if (latest && isOpenProposalStatus(latest.status)) {
    throw new MeetingProposalError("כבר קיימת הצעת מפגש פתוחה בחיבור הזה — אפשר לאשר, לדחות או להציע הצעה נגדית לה");
  }

  const meetLink = normalizeMeetLink(input.meetLink);

  await prisma.meetingProposal.create({
    data: {
      connectionId,
      proposedByUserId: userId,
      sessionType: input.sessionType,
      meetLink,
      scheduledAt: input.scheduledAt,
    },
  });
}

async function loadOpenProposalOrThrow(connectionId: string, proposalId: string) {
  const proposal = await prisma.meetingProposal.findUniqueOrThrow({ where: { id: proposalId } });
  if (proposal.connectionId !== connectionId) throw new MeetingProposalError("ההצעה אינה שייכת לחיבור הזה");
  if (!isOpenProposalStatus(proposal.status)) throw new MeetingProposalError("ההצעה כבר טופלה");
  return proposal;
}

/**
 * Confirms the connection's currently open proposal. The proposer may never
 * accept their own proposal — item 14.5's core requirement — since that
 * would let one person unilaterally "agree" for both parties; only the
 * other participant can accept.
 */
export async function acceptMeetingProposal(
  userId: string,
  connectionId: string,
  proposalId: string,
  options: { meetLink?: string } = {},
): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);

  const proposal = await loadOpenProposalOrThrow(connectionId, proposalId);
  if (proposal.proposedByUserId === userId) {
    throw new MeetingProposalError("לא ניתן לאשר הצעת מפגש שהצעתם בעצמכם");
  }

  const meetLink = options.meetLink !== undefined ? normalizeMeetLink(options.meetLink) : proposal.meetLink;

  await prisma.meetingProposal.update({
    where: { id: proposalId },
    data: { status: "ACCEPTED", respondedByUserId: userId, respondedAt: new Date(), meetLink },
  });
}

/**
 * Declines the connection's currently open proposal. Unlike accept/counter-
 * propose, the proposer themselves may also decline — that's a withdrawal of
 * their own still-open offer, a different (and harmless) action from
 * accepting/countering on the other person's behalf, so it isn't blocked.
 */
export async function declineMeetingProposal(userId: string, connectionId: string, proposalId: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);

  await loadOpenProposalOrThrow(connectionId, proposalId);

  await prisma.meetingProposal.update({
    where: { id: proposalId },
    data: { status: "DECLINED", respondedByUserId: userId, respondedAt: new Date() },
  });
}

export interface CounterProposeMeetingInput {
  sessionType?: ConnectionReason;
  meetLink?: string;
  scheduledAt?: Date;
}

/**
 * Responds to the connection's currently open proposal with a counter-
 * proposal: marks the existing one COUNTER_PROPOSED (terminal — see the
 * schema doc comment) and opens a fresh PROPOSED row in its place, now
 * awaiting a response from whoever made the original proposal. Like accept,
 * the original proposer cannot "counter" their own still-open proposal —
 * only the other participant can.
 */
export async function counterProposeMeeting(
  userId: string,
  connectionId: string,
  proposalId: string,
  input: CounterProposeMeetingInput,
): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);
  if (connection.status !== "ACTIVE") throw new MeetingProposalError("החיבור אינו פעיל");

  const proposal = await loadOpenProposalOrThrow(connectionId, proposalId);
  if (proposal.proposedByUserId === userId) {
    throw new MeetingProposalError("לא ניתן להציע הצעה נגדית להצעה שהצעתם בעצמכם");
  }

  const meetLink = normalizeMeetLink(input.meetLink);

  await prisma.$transaction([
    prisma.meetingProposal.update({
      where: { id: proposalId },
      data: { status: "COUNTER_PROPOSED", respondedByUserId: userId, respondedAt: new Date() },
    }),
    prisma.meetingProposal.create({
      data: {
        connectionId,
        proposedByUserId: userId,
        previousProposalId: proposalId,
        sessionType: input.sessionType ?? proposal.sessionType,
        meetLink,
        scheduledAt: input.scheduledAt,
      },
    }),
  ]);
}

/**
 * Attaches (or replaces) a Google Meet link on an existing proposal — any
 * connection participant may do this (item 14.8), independent of who
 * originally proposed or responded, and regardless of the proposal's current
 * status (a link can be added after acceptance too, e.g. "here's the actual
 * room now that it's confirmed"). Always backend-validated (item 14.9) —
 * never trusts a frontend URL check alone.
 */
export async function attachMeetLink(userId: string, connectionId: string, proposalId: string, meetLink: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);

  const proposal = await prisma.meetingProposal.findUniqueOrThrow({ where: { id: proposalId } });
  if (proposal.connectionId !== connectionId) throw new MeetingProposalError("ההצעה אינה שייכת לחיבור הזה");

  const validated = normalizeMeetLink(meetLink);
  if (!validated) throw new MeetingProposalError("יש להזין קישור תקין");

  await prisma.meetingProposal.update({ where: { id: proposalId }, data: { meetLink: validated } });
}

/** Whether the user has already connected their Google account for Meet-link generation — used by the page to decide between a "connect Google" CTA and a "generate link" button. */
export async function hasGoogleMeetGrant(userId: string): Promise<boolean> {
  const grant = await prisma.googleMeetGrant.findUnique({ where: { userId } });
  return grant !== null;
}

/** Persists (or replaces) a user's Google Meet grant after a successful incremental-consent exchange. Tokens are encrypted at rest — see crypto.ts's encryptSecret. */
export async function upsertGoogleMeetGrant(
  userId: string,
  tokens: { refreshToken: string; accessToken: string; accessTokenExpiresAt: Date; scope: string },
): Promise<void> {
  const data = {
    refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
    accessTokenEncrypted: encryptSecret(tokens.accessToken),
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    scope: tokens.scope,
  };
  await prisma.googleMeetGrant.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

/** Returns a valid (non-expired) access token for the user's Google Meet grant, refreshing and persisting it first if it's missing or within a minute of expiry. Null if the user has no grant, or if the refresh itself fails (e.g. a revoked grant). */
async function getValidGoogleMeetAccessToken(userId: string): Promise<string | null> {
  const grant = await prisma.googleMeetGrant.findUnique({ where: { userId } });
  if (!grant) return null;

  const needsRefresh =
    !grant.accessTokenEncrypted || !grant.accessTokenExpiresAt || grant.accessTokenExpiresAt.getTime() - Date.now() < 60 * 1000;
  if (!needsRefresh && grant.accessTokenEncrypted) {
    return decryptSecret(grant.accessTokenEncrypted);
  }

  const refreshToken = decryptSecret(grant.refreshTokenEncrypted);
  const refreshed = await getGoogleMeetClient().refreshAccessToken(refreshToken);
  if (!refreshed) return null;

  await prisma.googleMeetGrant.update({
    where: { userId },
    data: {
      accessTokenEncrypted: encryptSecret(refreshed.accessToken),
      accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
    },
  });
  return refreshed.accessToken;
}

/**
 * Generates a real Google Meet link (via Meet API v2's spaces.create, using
 * the calling user's own Google Meet grant) and attaches it to the given
 * proposal — the API-driven counterpart to attachMeetLink's manual-paste
 * path. Any connection participant may call this, same as attachMeetLink.
 */
export async function generateMeetLink(userId: string, connectionId: string, proposalId: string): Promise<void> {
  const connection = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
  assertParticipant(connection, userId);

  const proposal = await prisma.meetingProposal.findUniqueOrThrow({ where: { id: proposalId } });
  if (proposal.connectionId !== connectionId) throw new MeetingProposalError("ההצעה אינה שייכת לחיבור הזה");

  const accessToken = await getValidGoogleMeetAccessToken(userId);
  if (!accessToken) throw new MeetingProposalError("יש להתחבר תחילה לחשבון Google כדי ליצור קישור");

  const meetLink = await getGoogleMeetClient().createSpace(accessToken);
  if (!meetLink) throw new MeetingProposalError("יצירת קישור הפגישה נכשלה, נסו שוב");

  const validated = normalizeMeetLink(meetLink);
  if (!validated) throw new MeetingProposalError("יצירת קישור הפגישה נכשלה, נסו שוב");

  await prisma.meetingProposal.update({ where: { id: proposalId }, data: { meetLink: validated } });
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
