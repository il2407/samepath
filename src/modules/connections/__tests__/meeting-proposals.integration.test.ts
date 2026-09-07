// WS7 — MeetingProposal integration tests (backlog item 14).
//
// NOT YET RUNNABLE: this wave's migration protocol deliberately defers
// `prisma migrate` to the coordinator (see the WS7 final report). The
// `meeting_proposals` table these tests exercise does not exist in the test
// database yet, so every test here will fail with a Prisma
// "relation does not exist" error until that migration is applied post-
// rebase. Written in full now, on purpose, so the coordinator (or CI) can
// run this file immediately after applying the migration with no further
// authoring work — see the sibling service.integration.test.ts for the
// tests that ARE runnable today (they deliberately avoid this table; see
// the "Deliberately kept out of getConnectionDetail" comment in
// connections/service.ts for why the two are split).
import { beforeEach, describe, expect, it } from "vitest";
import { resetTestDatabase } from "@/shared/test/db";
import { createTestUser } from "@/shared/test/fixtures";
import { prisma } from "@/shared/db";
import {
  acceptMeetingProposal,
  attachMeetLink,
  counterProposeMeeting,
  createConnectionFromMatch,
  declineMeetingProposal,
  endConnection,
  getMeetingProposals,
  MeetingProposalError,
  proposeMeeting,
} from "@/modules/connections/service";

beforeEach(async () => {
  await resetTestDatabase();
});

async function createTestConnection() {
  const a = await createTestUser();
  const b = await createTestUser();
  const suggestion = await prisma.matchSuggestion.create({
    data: {
      userAId: a.user.id,
      userBId: b.user.id,
      profileAId: a.profile.id,
      profileBId: b.profile.id,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
  const connection = await createConnectionFromMatch(suggestion.id, a.user.id, b.user.id);
  return { a, b, connection };
}

describe("proposeMeeting", () => {
  it("opens a new PROPOSED proposal visible to both participants", async () => {
    const { a, b, connection } = await createTestConnection();

    await proposeMeeting(a.user.id, connection.id, { sessionType: "INTRO_VIDEO_CALL" });

    const forA = await getMeetingProposals(a.user.id, connection.id);
    const forB = await getMeetingProposals(b.user.id, connection.id);
    expect(forA).toHaveLength(1);
    expect(forA[0]).toMatchObject({ status: "PROPOSED", proposedByUserId: a.user.id, sessionType: "INTRO_VIDEO_CALL" });
    expect(forB[0]?.id).toBe(forA[0]?.id);
  });

  it("stores a valid meet link and a scheduledAt", async () => {
    const { a, connection } = await createTestConnection();
    const scheduledAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await proposeMeeting(a.user.id, connection.id, {
      meetLink: "https://meet.google.com/abc-defg-hij",
      scheduledAt,
    });

    const [proposal] = await getMeetingProposals(a.user.id, connection.id);
    expect(proposal?.meetLink).toBe("https://meet.google.com/abc-defg-hij");
    expect(proposal?.scheduledAt?.getTime()).toBe(scheduledAt.getTime());
  });

  it("rejects an invalid meet link and creates no row (backend validation, item 14.9)", async () => {
    const { a, connection } = await createTestConnection();

    await expect(proposeMeeting(a.user.id, connection.id, { meetLink: "https://zoom.us/j/12345" })).rejects.toBeInstanceOf(MeetingProposalError);

    expect(await getMeetingProposals(a.user.id, connection.id)).toHaveLength(0);
  });

  it("refuses a non-participant", async () => {
    const { connection } = await createTestConnection();
    const outsider = await createTestUser();
    await expect(proposeMeeting(outsider.user.id, connection.id, {})).rejects.toThrow();
  });

  it("refuses once the connection is no longer ACTIVE", async () => {
    const { a, connection } = await createTestConnection();
    await endConnection(a.user.id, connection.id);
    await expect(proposeMeeting(a.user.id, connection.id, {})).rejects.toThrow();
  });

  it("refuses a second, independent proposal while one is already open (item 14.7 — duplicate-open-proposal guard), with a clean user-facing message", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});

    await expect(proposeMeeting(b.user.id, connection.id, {})).rejects.toBeInstanceOf(MeetingProposalError);
    expect(await getMeetingProposals(a.user.id, connection.id)).toHaveLength(1);
  });

  it("allows a fresh proposal once the previous one was resolved (accepted)", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [first] = await getMeetingProposals(a.user.id, connection.id);
    await acceptMeetingProposal(b.user.id, connection.id, first!.id);

    await proposeMeeting(b.user.id, connection.id, {});

    const proposals = await getMeetingProposals(a.user.id, connection.id);
    expect(proposals).toHaveLength(2);
    expect(proposals[0]?.status).toBe("PROPOSED");
  });

  it("allows a fresh proposal once the previous one was resolved (declined)", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [first] = await getMeetingProposals(a.user.id, connection.id);
    await declineMeetingProposal(b.user.id, connection.id, first!.id);

    await proposeMeeting(a.user.id, connection.id, {});

    const proposals = await getMeetingProposals(a.user.id, connection.id);
    expect(proposals).toHaveLength(2);
    expect(proposals[0]?.status).toBe("PROPOSED");
  });
});

describe("acceptMeetingProposal", () => {
  it("lets the non-proposing participant accept", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);

    await acceptMeetingProposal(b.user.id, connection.id, proposal!.id);

    const [updated] = await getMeetingProposals(a.user.id, connection.id);
    expect(updated).toMatchObject({ status: "ACCEPTED", respondedByUserId: b.user.id });
    expect(updated?.respondedAt).not.toBeNull();
  });

  it("never lets the proposer accept their own proposal (item 14.5 — the core requirement), with a clean user-facing message", async () => {
    const { a, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);

    await expect(acceptMeetingProposal(a.user.id, connection.id, proposal!.id)).rejects.toBeInstanceOf(MeetingProposalError);

    const [unchanged] = await getMeetingProposals(a.user.id, connection.id);
    expect(unchanged?.status).toBe("PROPOSED");
  });

  it("refuses to accept a proposal that was already resolved", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);
    await declineMeetingProposal(b.user.id, connection.id, proposal!.id);

    await expect(acceptMeetingProposal(b.user.id, connection.id, proposal!.id)).rejects.toThrow();
  });

  it("refuses a non-participant", async () => {
    const { a, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);
    const outsider = await createTestUser();

    await expect(acceptMeetingProposal(outsider.user.id, connection.id, proposal!.id)).rejects.toThrow();
  });

  it("can update the meet link at accept time", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);

    await acceptMeetingProposal(b.user.id, connection.id, proposal!.id, { meetLink: "https://meet.google.com/abc-defg-hij" });

    const [updated] = await getMeetingProposals(a.user.id, connection.id);
    expect(updated?.meetLink).toBe("https://meet.google.com/abc-defg-hij");
  });
});

describe("declineMeetingProposal", () => {
  it("lets the non-proposing participant decline", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);

    await declineMeetingProposal(b.user.id, connection.id, proposal!.id);

    const [updated] = await getMeetingProposals(a.user.id, connection.id);
    expect(updated).toMatchObject({ status: "DECLINED", respondedByUserId: b.user.id });
  });

  it("also lets the proposer withdraw their own still-open proposal (documented decision — see the WS7 final report)", async () => {
    const { a, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);

    await declineMeetingProposal(a.user.id, connection.id, proposal!.id);

    const [updated] = await getMeetingProposals(a.user.id, connection.id);
    expect(updated).toMatchObject({ status: "DECLINED", respondedByUserId: a.user.id });
  });

  it("refuses a non-participant", async () => {
    const { a, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);
    const outsider = await createTestUser();

    await expect(declineMeetingProposal(outsider.user.id, connection.id, proposal!.id)).rejects.toThrow();
  });
});

describe("counterProposeMeeting", () => {
  it("marks the original COUNTER_PROPOSED and opens a fresh PROPOSED row pointing back at it", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, { sessionType: "INTRO_VIDEO_CALL" });
    const [original] = await getMeetingProposals(a.user.id, connection.id);

    await counterProposeMeeting(b.user.id, connection.id, original!.id, { sessionType: "CODING_PRACTICE" });

    const proposals = await getMeetingProposals(a.user.id, connection.id);
    expect(proposals).toHaveLength(2);
    const [latest, previous] = proposals;
    expect(previous).toMatchObject({ id: original!.id, status: "COUNTER_PROPOSED", respondedByUserId: b.user.id });
    expect(latest).toMatchObject({ status: "PROPOSED", proposedByUserId: b.user.id, sessionType: "CODING_PRACTICE", previousProposalId: original!.id });
  });

  it("only the counter-proposal's own new row is open — the original proposer must respond to the counter, not re-counter the counter as themselves", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [original] = await getMeetingProposals(a.user.id, connection.id);
    await counterProposeMeeting(b.user.id, connection.id, original!.id, {});
    const [counter] = await getMeetingProposals(a.user.id, connection.id);

    // b proposed the counter — b cannot accept/counter it themselves either.
    await expect(acceptMeetingProposal(b.user.id, connection.id, counter!.id)).rejects.toThrow();
    // a (the original proposer) can accept the counter.
    await acceptMeetingProposal(a.user.id, connection.id, counter!.id);
    const [resolved] = await getMeetingProposals(a.user.id, connection.id);
    expect(resolved?.status).toBe("ACCEPTED");
  });

  it("never lets the current proposer counter-propose their own open proposal", async () => {
    const { a, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);

    await expect(counterProposeMeeting(a.user.id, connection.id, proposal!.id, {})).rejects.toThrow();
  });

  it("refuses to counter a proposal that is no longer open", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);
    await acceptMeetingProposal(b.user.id, connection.id, proposal!.id);

    await expect(counterProposeMeeting(b.user.id, connection.id, proposal!.id, {})).rejects.toThrow();
  });

  it("refuses a non-participant", async () => {
    const { a, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);
    const outsider = await createTestUser();

    await expect(counterProposeMeeting(outsider.user.id, connection.id, proposal!.id, {})).rejects.toThrow();
  });
});

describe("attachMeetLink", () => {
  it("lets either participant attach a link, regardless of who proposed", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);

    await attachMeetLink(b.user.id, connection.id, proposal!.id, "https://meet.google.com/abc-defg-hij");

    const [updated] = await getMeetingProposals(a.user.id, connection.id);
    expect(updated?.meetLink).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("can attach a link even after the proposal was already accepted", async () => {
    const { a, b, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);
    await acceptMeetingProposal(b.user.id, connection.id, proposal!.id);

    await attachMeetLink(a.user.id, connection.id, proposal!.id, "https://meet.google.com/abc-defg-hij");

    const [updated] = await getMeetingProposals(a.user.id, connection.id);
    expect(updated).toMatchObject({ status: "ACCEPTED", meetLink: "https://meet.google.com/abc-defg-hij" });
  });

  it("rejects a non-Meet / non-https link with a clear error, and leaves the existing link untouched", async () => {
    const { a, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, { meetLink: "https://meet.google.com/abc-defg-hij" });
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);

    await expect(attachMeetLink(a.user.id, connection.id, proposal!.id, "http://meet.google.com/abc-defg-hij")).rejects.toThrow();
    await expect(attachMeetLink(a.user.id, connection.id, proposal!.id, "https://evil.example/abc-defg-hij")).rejects.toThrow();
    await expect(attachMeetLink(a.user.id, connection.id, proposal!.id, "not a link")).rejects.toThrow();

    const [unchanged] = await getMeetingProposals(a.user.id, connection.id);
    expect(unchanged?.meetLink).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("refuses a non-participant", async () => {
    const { a, connection } = await createTestConnection();
    await proposeMeeting(a.user.id, connection.id, {});
    const [proposal] = await getMeetingProposals(a.user.id, connection.id);
    const outsider = await createTestUser();

    await expect(attachMeetLink(outsider.user.id, connection.id, proposal!.id, "https://meet.google.com/abc-defg-hij")).rejects.toThrow();
  });
});
