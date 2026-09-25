"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/session";
import { rateLimit } from "@/shared/rate-limit";
import {
  acceptMeetingProposal,
  attachMeetLink,
  attachMeetLinkForConnection,
  blockFromConnection,
  clearConnectionGuide,
  counterProposeMeeting,
  declineMeetingProposal,
  endConnection,
  generateMeetLink,
  generateMeetLinkForConnection,
  listGuideOptionsForConnection,
  markMeeting,
  MeetingProposalError,
  proposeMeeting,
  reportConnection,
  selectConnectionGuide,
  sendMessage,
  setMyIntroRequirement,
  setMySessionTypes,
  suggestGuideForConnection,
} from "@/modules/connections/service";
import { PRACTICE_SESSION_CATEGORIES, type PracticeSessionCategorySlug } from "@/modules/guides/service";
import type { ConnectionReason } from "@/generated/prisma/client";
import { logger } from "@/shared/logger";

export type ActionState = { ok: boolean; error?: string };

export async function sendMessageAction(connectionId: string, body: string): Promise<ActionState> {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "ההודעה ריקה" };
  if (trimmed.length > 4000) return { ok: false, error: "ההודעה ארוכה מדי" };
  if (!(await rateLimit(`message:send:${user.id}`, 60, 10 * 60 * 1000)).allowed) {
    return { ok: false, error: "שלחתם הרבה הודעות ברצף. נסו שוב בעוד כמה דקות" };
  }

  try {
    await sendMessage(user.id, connectionId, trimmed);
    revalidatePath(`/app/connections/${connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

const meetingSchema = z.object({
  connectionId: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  note: z.string().max(1000).optional(),
});

export async function markMeetingAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await markMeeting(user.id, parsed.data.connectionId, parsed.data);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

export async function endConnectionAction(connectionId: string): Promise<ActionState> {
  const user = await requireUser();
  await endConnection(user.id, connectionId);
  revalidatePath(`/app/connections/${connectionId}`);
  revalidatePath("/app/connections");
  return { ok: true };
}

export async function blockConnectionAction(connectionId: string, reason?: string): Promise<ActionState> {
  const user = await requireUser();
  await blockFromConnection(user.id, connectionId, reason);
  revalidatePath(`/app/connections/${connectionId}`);
  revalidatePath("/app/connections");
  return { ok: true };
}

const reportSchema = z.object({
  connectionId: z.string().min(1),
  category: z.enum(["SAFETY_CONCERN", "HARASSMENT", "SPAM", "FAKE_PROFILE", "PRIVACY_CONCERN", "NO_SHOW", "OTHER"]),
  description: z.string().min(1, "נא לפרט").max(2000),
});

export async function reportConnectionAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  if (!(await rateLimit(`report:submit:${user.id}`, 10, 24 * 60 * 60 * 1000)).allowed) return { ok: false, error: "יותר מדי פעולות. נסו שוב מאוחר יותר" };
  await reportConnection(user.id, parsed.data.connectionId, parsed.data.category, parsed.data.description);
  revalidatePath(`/app/connections/${parsed.data.connectionId}`);
  return { ok: true };
}

const categorySlugs = PRACTICE_SESSION_CATEGORIES.map((c) => c.slug) as [
  PracticeSessionCategorySlug,
  ...PracticeSessionCategorySlug[],
];
const pickGuideSchema = z.object({
  connectionId: z.string().min(1),
  category: z.enum(categorySlugs),
});

/** Picks a random published guide from the category and attaches it to the connection immediately — visible to both participants, still fully optional (can be cleared or re-picked any time). */
export async function pickGuideForConnectionAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = pickGuideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    const guide = await suggestGuideForConnection(user.id, parsed.data.connectionId, parsed.data.category);
    if (!guide) return { ok: false, error: "אין עדיין הצעות בקטגוריה הזו" };

    await selectConnectionGuide(user.id, parsed.data.connectionId, guide.id);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

/** Lists a category's published guides so the connection room can offer a browse-and-pick flow instead of only a random suggestion. */
export async function listGuideOptionsAction(
  input: unknown,
): Promise<{ ok: true; guides: Awaited<ReturnType<typeof listGuideOptionsForConnection>> } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = pickGuideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    const guides = await listGuideOptionsForConnection(user.id, parsed.data.connectionId, parsed.data.category);
    return { ok: true, guides };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

const selectGuideSchema = z.object({
  connectionId: z.string().min(1),
  guideId: z.string().min(1),
});

/** Attaches a specific guide the user picked from the browse list — bypasses the random pick in pickGuideForConnectionAction. */
export async function selectGuideForConnectionAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = selectGuideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await selectConnectionGuide(user.id, parsed.data.connectionId, parsed.data.guideId);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

export async function clearConnectionGuideAction(connectionId: string): Promise<ActionState> {
  const user = await requireUser();
  try {
    await clearConnectionGuide(user.id, connectionId);
    revalidatePath(`/app/connections/${connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

const connectionReasonEnum = z.enum([
  "SHARE_JOB_SEARCH",
  "ACCOUNTABILITY",
  "PROFESSIONAL_DISCUSSION",
  "LEARNING_TOGETHER",
  "INTRO_VIDEO_CALL",
  "CODING_PRACTICE",
  "SYSTEM_DESIGN",
  "INTERVIEW_SIMULATION",
  "PROJECT_PITCH",
  "BEHAVIORAL_INTERVIEW",
  "MENTAL_SUPPORT",
  "OTHER",
]);

const sessionTypesSchema = z.object({
  connectionId: z.string().min(1),
  sessionTypes: z.array(connectionReasonEnum),
});

export async function setMySessionTypesAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = sessionTypesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await setMySessionTypes(user.id, parsed.data.connectionId, parsed.data.sessionTypes as ConnectionReason[]);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

const introRequirementSchema = z.object({
  connectionId: z.string().min(1),
  stance: z.enum(["REQUIRED", "NOT_REQUIRED"]),
});

/** Each side's own, informational-only declaration of whether a video intro meeting is a prerequisite for them — never technically enforced; see IntroMeetingStance in service.ts. */
export async function setMyIntroRequirementAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = introRequirementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await setMyIntroRequirement(user.id, parsed.data.connectionId, parsed.data.stance);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש. נסו שוב" };
  }
}

// ---------------------------------------------------------------------------
// Meeting proposals (WS7, backlog item 14)
// ---------------------------------------------------------------------------

/**
 * Only a deliberate MeetingProposalError's message is ever surfaced to the
 * user (duplicate-open-proposal, self-accept, invalid link, etc. — the
 * service layer already writes those as clear, user-facing Hebrew text).
 * Anything else — a raw Prisma/db error, for instance — falls back to the
 * same generic message every other action in this file uses, and is logged
 * server-side instead: an internal error's real message (which can include
 * bundler-mangled internals, e.g. "relation meeting_proposals does not
 * exist" pre-migration) must never render verbatim in the UI. See
 * MeetingProposalError's doc comment in service.ts for how this was caught.
 */
function meetingProposalErrorMessage(error: unknown): string {
  if (error instanceof MeetingProposalError) return error.message;
  logger.error("meeting proposal action failed", { error });
  return "משהו השתבש. נסו שוב";
}

const meetLinkField = z.string().trim().max(500).optional();
const scheduledAtField = z.coerce.date().optional();

const proposeMeetingSchema = z.object({
  connectionId: z.string().min(1),
  sessionType: connectionReasonEnum.optional(),
  meetLink: meetLinkField,
  scheduledAt: scheduledAtField,
});

export async function proposeMeetingAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = proposeMeetingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };
  if (!(await rateLimit(`meeting:propose:${user.id}`, 30, 60 * 60 * 1000)).allowed) return { ok: false, error: "יותר מדי פעולות. נסו שוב מאוחר יותר" };

  try {
    await proposeMeeting(user.id, parsed.data.connectionId, {
      sessionType: parsed.data.sessionType as ConnectionReason | undefined,
      meetLink: parsed.data.meetLink,
      scheduledAt: parsed.data.scheduledAt,
    });
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: meetingProposalErrorMessage(error) };
  }
}

const respondToProposalSchema = z.object({
  connectionId: z.string().min(1),
  proposalId: z.string().min(1),
});

export async function acceptMeetingProposalAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = respondToProposalSchema.extend({ meetLink: meetLinkField }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await acceptMeetingProposal(user.id, parsed.data.connectionId, parsed.data.proposalId, { meetLink: parsed.data.meetLink });
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: meetingProposalErrorMessage(error) };
  }
}

export async function declineMeetingProposalAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = respondToProposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await declineMeetingProposal(user.id, parsed.data.connectionId, parsed.data.proposalId);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: meetingProposalErrorMessage(error) };
  }
}

const counterProposeMeetingSchema = respondToProposalSchema.extend({
  sessionType: connectionReasonEnum.optional(),
  meetLink: meetLinkField,
  scheduledAt: scheduledAtField,
});

export async function counterProposeMeetingAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = counterProposeMeetingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await counterProposeMeeting(user.id, parsed.data.connectionId, parsed.data.proposalId, {
      sessionType: parsed.data.sessionType as ConnectionReason | undefined,
      meetLink: parsed.data.meetLink,
      scheduledAt: parsed.data.scheduledAt,
    });
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: meetingProposalErrorMessage(error) };
  }
}

const attachMeetLinkSchema = respondToProposalSchema.extend({
  meetLink: z.string().trim().min(1).max(500),
});

export async function attachMeetLinkAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = attachMeetLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await attachMeetLink(user.id, parsed.data.connectionId, parsed.data.proposalId, parsed.data.meetLink);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: meetingProposalErrorMessage(error) };
  }
}

export async function generateMeetLinkAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = respondToProposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await generateMeetLink(user.id, parsed.data.connectionId, parsed.data.proposalId);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: meetingProposalErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Simplified connection room: attach/generate a Meet link directly on a
// connection, with no proposal-negotiation UI and no proposalId from the
// caller. Delegates to service.ts's getOrCreateMeetLinkHolderProposal, which
// reuses an existing proposal or creates a minimal placeholder row to hold
// the link — see that function's doc comment for the concurrency handling.
// ---------------------------------------------------------------------------

const attachMeetLinkForConnectionSchema = z.object({
  connectionId: z.string().min(1),
  meetLink: z.string().trim().min(1).max(500),
});

export async function attachMeetLinkForConnectionAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = attachMeetLinkForConnectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await attachMeetLinkForConnection(user.id, parsed.data.connectionId, parsed.data.meetLink);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: meetingProposalErrorMessage(error) };
  }
}

const generateMeetLinkForConnectionSchema = z.object({
  connectionId: z.string().min(1),
});

export async function generateMeetLinkForConnectionAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = generateMeetLinkForConnectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "נתונים לא תקינים" };

  try {
    await generateMeetLinkForConnection(user.id, parsed.data.connectionId);
    revalidatePath(`/app/connections/${parsed.data.connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: meetingProposalErrorMessage(error) };
  }
}
