// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { ConnectionRoom } from "@/modules/connections/ConnectionRoom";
import type { ConnectionDetail, MeetingProposalDetail } from "@/modules/connections/service";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  sendMessageAction: vi.fn(),
  markMeetingAction: vi.fn(),
  endConnectionAction: vi.fn(),
  blockConnectionAction: vi.fn(),
  reportConnectionAction: vi.fn(),
  pickGuideForConnectionAction: vi.fn(),
  clearConnectionGuideAction: vi.fn(),
  setMySessionTypesAction: vi.fn(),
  proposeMeetingAction: vi.fn(),
  acceptMeetingProposalAction: vi.fn(),
  declineMeetingProposalAction: vi.fn(),
  counterProposeMeetingAction: vi.fn(),
  attachMeetLinkAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/modules/connections/actions", () => ({
  sendMessageAction: mocks.sendMessageAction,
  markMeetingAction: mocks.markMeetingAction,
  endConnectionAction: mocks.endConnectionAction,
  blockConnectionAction: mocks.blockConnectionAction,
  reportConnectionAction: mocks.reportConnectionAction,
  pickGuideForConnectionAction: mocks.pickGuideForConnectionAction,
  clearConnectionGuideAction: mocks.clearConnectionGuideAction,
  setMySessionTypesAction: mocks.setMySessionTypesAction,
  proposeMeetingAction: mocks.proposeMeetingAction,
  acceptMeetingProposalAction: mocks.acceptMeetingProposalAction,
  declineMeetingProposalAction: mocks.declineMeetingProposalAction,
  counterProposeMeetingAction: mocks.counterProposeMeetingAction,
  attachMeetLinkAction: mocks.attachMeetLinkAction,
}));

const CURRENT_USER_ID = "user-me";
const OTHER_USER_ID = "user-other";

const baseOtherParty: ConnectionDetail["otherParty"] = {
  professionalField: "הנדסת תוכנה",
  seniorityBand: "בכיר/ה",
  targetRoles: [],
  skillsAndDomains: [],
  languages: [],
  shortIntro: "",
  connectionFormat: "BOTH",
  connectionCadence: "BOTH",
  connectionMode: "BOTH",
  reasons: [],
  availabilitySummary: [],
  company: null,
  cvVerified: false,
  fullName: "דנה כהן",
  region: null,
  email: "dana@example.com",
  phoneNumber: null,
};

function makeConnection(overrides: Partial<ConnectionDetail> = {}): ConnectionDetail {
  return {
    id: "connection-1",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    otherParty: baseOtherParty,
    otherPartyDisplayName: "דנה כהן",
    otherPartyPhotoDataUrl: null,
    messages: [],
    meetingStatuses: [],
    myTimezone: "Asia/Jerusalem",
    selectedGuide: null,
    mySessionTypes: [],
    otherPartySessionTypes: [],
    ...overrides,
  };
}

const categories = [{ slug: "intro", labelHe: "פגישת היכרות בווידאו" }] as const;

function renderRoom(connectionOverrides: Partial<ConnectionDetail> = {}, meetingProposals: MeetingProposalDetail[] = []) {
  return render(
    <ConnectionRoom
      connection={makeConnection(connectionOverrides)}
      meetingProposals={meetingProposals}
      currentUserId={CURRENT_USER_ID}
      categories={categories}
    />,
  );
}

beforeEach(() => {
  Object.values(mocks).forEach((fn) => fn.mockReset?.());
  mocks.sendMessageAction.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
});

describe("ConnectionRoom — chat (backlog item 13)", () => {
  it("shows an empty-state message when there are no messages yet", () => {
    renderRoom();
    expect(screen.getByText(/עדיין אין הודעות/)).toBeInTheDocument();
  });

  it("has an accessible label on the message input and a real, keyboard-activatable submit button", () => {
    renderRoom();
    const input = screen.getByLabelText("כתיבת הודעה");
    expect(input).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "שליחה" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("aligns the viewer's own messages flush to the physical right and the other party's flush left (RTL fix)", () => {
    const { container } = renderRoom({
      messages: [
        { id: "m1", senderId: CURRENT_USER_ID, body: "שלום", createdAt: new Date() },
        { id: "m2", senderId: OTHER_USER_ID, body: "היי", createdAt: new Date() },
      ],
    });
    const rows = container.querySelectorAll(".flex.items-end.gap-2");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass("justify-end"); // mine -> flush right
    expect(rows[1]).toHaveClass("justify-start"); // other party -> flush left

    const bubbles = container.querySelectorAll('[dir="auto"]');
    expect(bubbles[0]).toHaveClass("rounded-tr-sm", "bg-mint");
    expect(bubbles[1]).toHaveClass("rounded-tl-sm", "bg-paper");
  });

  it("applies dir=auto and word-wrapping classes to every message bubble (mixed Hebrew/English/URL content)", () => {
    const longUrl = "https://example.com/" + "a".repeat(80);
    const { container } = renderRoom({
      messages: [{ id: "m1", senderId: CURRENT_USER_ID, body: `בואו נדבר על ${longUrl}`, createdAt: new Date() }],
    });
    const bubble = container.querySelector('[dir="auto"]');
    expect(bubble).toBeInTheDocument();
    expect(bubble).toHaveClass("break-words");
    expect(bubble?.className).toContain("overflow-wrap:anywhere");
  });

  it("renders a per-message avatar for the other party's messages using otherPartyPhotoDataUrl, never for the viewer's own", () => {
    const { container } = renderRoom({
      otherPartyPhotoDataUrl: "data:image/jpeg;base64,AAAA",
      messages: [
        { id: "m1", senderId: CURRENT_USER_ID, body: "שלום", createdAt: new Date() },
        { id: "m2", senderId: OTHER_USER_ID, body: "היי", createdAt: new Date() },
      ],
    });
    const rows = container.querySelectorAll(".flex.items-end.gap-2");
    expect(rows[0]?.querySelector("img")).not.toBeInTheDocument();
    const otherRowImg = rows[1]?.querySelector("img");
    expect(otherRowImg).toBeInTheDocument();
    expect(otherRowImg).toHaveAttribute("src", "data:image/jpeg;base64,AAAA");
  });

  it("falls back to the anonymous Avatar (no <img>) for the other party when there is no photo", () => {
    const { container } = renderRoom({
      otherPartyPhotoDataUrl: null,
      messages: [{ id: "m1", senderId: OTHER_USER_ID, body: "היי", createdAt: new Date() }],
    });
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows an optimistic 'sending' bubble immediately, then resolves once the action succeeds", async () => {
    let resolveSend!: (value: { ok: true }) => void;
    mocks.sendMessageAction.mockReturnValue(new Promise((resolve) => (resolveSend = resolve)));
    renderRoom();

    const input = screen.getByLabelText("כתיבת הודעה");
    fireEvent.change(input, { target: { value: "הודעת בדיקה" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText("שולח…")).toBeInTheDocument();
    expect(screen.getByText("הודעת בדיקה")).toBeInTheDocument();

    resolveSend({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("shows a failure state with retry when the send action fails, and retry re-invokes it", async () => {
    mocks.sendMessageAction.mockResolvedValueOnce({ ok: false, error: "משהו השתבש" });
    renderRoom();

    const input = screen.getByLabelText("כתיבת הודעה");
    fireEvent.change(input, { target: { value: "הודעה שנכשלת" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText("משהו השתבש");
    expect(screen.getByRole("button", { name: "ניסיון חוזר" })).toBeInTheDocument();

    mocks.sendMessageAction.mockResolvedValueOnce({ ok: true });
    fireEvent.click(screen.getByRole("button", { name: "ניסיון חוזר" }));

    await waitFor(() => expect(mocks.sendMessageAction).toHaveBeenCalledTimes(2));
    expect(mocks.sendMessageAction).toHaveBeenNthCalledWith(2, "connection-1", "הודעה שנכשלת");
  });

  it("lets a failed message be discarded", async () => {
    mocks.sendMessageAction.mockResolvedValueOnce({ ok: false, error: "משהו השתבש" });
    renderRoom();

    const input = screen.getByLabelText("כתיבת הודעה");
    fireEvent.change(input, { target: { value: "למחוק" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText("משהו השתבש");
    fireEvent.click(screen.getByRole("button", { name: "מחיקה" }));

    await waitFor(() => expect(screen.queryByText("למחוק")).not.toBeInTheDocument());
  });

  it("never sends a message twice for a rapid double-submit (backlog item 13.9)", async () => {
    let resolveSend!: (value: { ok: true }) => void;
    mocks.sendMessageAction.mockReturnValue(new Promise((resolve) => (resolveSend = resolve)));
    renderRoom();

    const input = screen.getByLabelText("כתיבת הודעה") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "פעם אחת בלבד" } });
    const form = input.closest("form")!;

    // Two submits fired back-to-back, before React has a chance to re-render
    // the disabled button — simulates a fast double-click closing the same
    // race a synchronous ref guard (not just `disabled={pending}`) is meant to close.
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mocks.sendMessageAction).toHaveBeenCalledTimes(1);
    resolveSend({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("does not submit an empty or whitespace-only message", () => {
    renderRoom();
    const input = screen.getByLabelText("כתיבת הודעה");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(mocks.sendMessageAction).not.toHaveBeenCalled();
  });

  it("does not render the chat form once the connection is no longer ACTIVE", () => {
    renderRoom({ status: "ENDED" });
    expect(screen.queryByLabelText("כתיבת הודעה")).not.toBeInTheDocument();
  });
});

describe("ConnectionRoom — meeting proposals (backlog item 14)", () => {
  it("offers to propose a meeting when there is no existing proposal", () => {
    renderRoom();
    expect(screen.getByRole("button", { name: "הצעת פגישת היכרות בווידאו" })).toBeInTheDocument();
  });

  it("shows accept/decline/counter-propose to the non-proposing participant when a proposal is open", () => {
    const proposal: MeetingProposalDetail = {
      id: "p1",
      status: "PROPOSED",
      proposedByUserId: OTHER_USER_ID,
      respondedByUserId: null,
      respondedAt: null,
      sessionType: "INTRO_VIDEO_CALL",
      meetLink: null,
      scheduledAt: null,
      previousProposalId: null,
      createdAt: new Date(),
    };
    renderRoom({}, [proposal]);

    expect(screen.getByRole("button", { name: "אישור ההצעה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "דחייה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /הצעה נגדית/ })).toBeInTheDocument();
  });

  it("never offers to accept your own open proposal — only a withdraw (decline) option", () => {
    const proposal: MeetingProposalDetail = {
      id: "p1",
      status: "PROPOSED",
      proposedByUserId: CURRENT_USER_ID,
      respondedByUserId: null,
      respondedAt: null,
      sessionType: "INTRO_VIDEO_CALL",
      meetLink: null,
      scheduledAt: null,
      previousProposalId: null,
      createdAt: new Date(),
    };
    renderRoom({}, [proposal]);

    expect(screen.queryByRole("button", { name: "אישור ההצעה" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ביטול ההצעה" })).toBeInTheDocument();
  });

  it("calls acceptMeetingProposalAction with the connection and proposal ids when accepting", async () => {
    mocks.acceptMeetingProposalAction.mockResolvedValue({ ok: true });
    const proposal: MeetingProposalDetail = {
      id: "p1",
      status: "PROPOSED",
      proposedByUserId: OTHER_USER_ID,
      respondedByUserId: null,
      respondedAt: null,
      sessionType: null,
      meetLink: null,
      scheduledAt: null,
      previousProposalId: null,
      createdAt: new Date(),
    };
    renderRoom({}, [proposal]);

    fireEvent.click(screen.getByRole("button", { name: "אישור ההצעה" }));

    await waitFor(() => expect(mocks.acceptMeetingProposalAction).toHaveBeenCalledWith({ connectionId: "connection-1", proposalId: "p1" }));
  });

  it("shows a Meet link as a clickable, LTR, break-all link when present", () => {
    const proposal: MeetingProposalDetail = {
      id: "p1",
      status: "ACCEPTED",
      proposedByUserId: OTHER_USER_ID,
      respondedByUserId: CURRENT_USER_ID,
      respondedAt: new Date(),
      sessionType: null,
      meetLink: "https://meet.google.com/abc-defg-hij",
      scheduledAt: null,
      previousProposalId: null,
      createdAt: new Date(),
    };
    renderRoom({}, [proposal]);
    const link = screen.getByRole("link", { name: "https://meet.google.com/abc-defg-hij" });
    expect(link).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    expect(link).toHaveAttribute("dir", "ltr");
  });
});
