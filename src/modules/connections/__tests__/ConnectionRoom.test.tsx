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
  setMyIntroRequirementAction: vi.fn(),
  listGuideOptionsAction: vi.fn(),
  selectGuideForConnectionAction: vi.fn(),
  proposeMeetingAction: vi.fn(),
  acceptMeetingProposalAction: vi.fn(),
  declineMeetingProposalAction: vi.fn(),
  counterProposeMeetingAction: vi.fn(),
  attachMeetLinkAction: vi.fn(),
  generateMeetLinkAction: vi.fn(),
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
  setMyIntroRequirementAction: mocks.setMyIntroRequirementAction,
  listGuideOptionsAction: mocks.listGuideOptionsAction,
  selectGuideForConnectionAction: mocks.selectGuideForConnectionAction,
  proposeMeetingAction: mocks.proposeMeetingAction,
  acceptMeetingProposalAction: mocks.acceptMeetingProposalAction,
  declineMeetingProposalAction: mocks.declineMeetingProposalAction,
  counterProposeMeetingAction: mocks.counterProposeMeetingAction,
  attachMeetLinkAction: mocks.attachMeetLinkAction,
  generateMeetLinkAction: mocks.generateMeetLinkAction,
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
    myIntroStance: null,
    otherPartyIntroStance: null,
    ...overrides,
  };
}

const categories = [{ slug: "intro", labelHe: "פגישת היכרות בווידאו" }] as const;

function renderRoom(
  connectionOverrides: Partial<ConnectionDetail> = {},
  meetingProposals: MeetingProposalDetail[] = [],
  hasGoogleMeetConnected = false,
) {
  return render(
    <ConnectionRoom
      connection={makeConnection(connectionOverrides)}
      meetingProposals={meetingProposals}
      currentUserId={CURRENT_USER_ID}
      categories={categories}
      hasGoogleMeetConnected={hasGoogleMeetConnected}
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

  it("offers a Google connect CTA (not a generate button) when the user has no Google Meet grant", () => {
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
    renderRoom({}, [proposal], false);

    const connectLink = screen.getByRole("link", { name: "התחברות ל-Google ליצירת קישור Meet" });
    expect(connectLink).toHaveAttribute(
      "href",
      "/api/auth/google-meet/start?returnTo=%2Fapp%2Fconnections%2Fconnection-1",
    );
    expect(screen.queryByRole("button", { name: "יצירת קישור Google Meet" })).not.toBeInTheDocument();
  });

  it("calls generateMeetLinkAction with the connection and proposal ids when the user has a Google Meet grant", async () => {
    mocks.generateMeetLinkAction.mockResolvedValue({ ok: true });
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
    renderRoom({}, [proposal], true);

    fireEvent.click(screen.getByRole("button", { name: "יצירת קישור Google Meet" }));

    await waitFor(() =>
      expect(mocks.generateMeetLinkAction).toHaveBeenCalledWith({ connectionId: "connection-1", proposalId: "p1" }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("surfaces an error from generateMeetLinkAction without crashing", async () => {
    mocks.generateMeetLinkAction.mockResolvedValue({ ok: false, error: "יצירת קישור הפגישה נכשלה, נסו שוב" });
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
    renderRoom({}, [proposal], true);

    fireEvent.click(screen.getByRole("button", { name: "יצירת קישור Google Meet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("יצירת קישור הפגישה נכשלה, נסו שוב");
  });
});

describe("ConnectionRoom — intro meeting requirement stance", () => {
  it("reflects myIntroStance as the checkbox's checked state", () => {
    renderRoom({ myIntroStance: "REQUIRED" });
    const checkbox = screen.getByRole("checkbox", { name: /חובה שתהיה פגישת היכרות בוידאו/ });
    expect(checkbox).toBeChecked();
  });

  it("is unchecked when no stance has been declared yet", () => {
    renderRoom();
    const checkbox = screen.getByRole("checkbox", { name: /חובה שתהיה פגישת היכרות בוידאו/ });
    expect(checkbox).not.toBeChecked();
  });

  it("calls setMyIntroRequirementAction with REQUIRED when checked, and refreshes", async () => {
    mocks.setMyIntroRequirementAction.mockResolvedValue({ ok: true });
    renderRoom();
    const checkbox = screen.getByRole("checkbox", { name: /חובה שתהיה פגישת היכרות בוידאו/ });

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(mocks.setMyIntroRequirementAction).toHaveBeenCalledWith({ connectionId: "connection-1", stance: "REQUIRED" }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("calls setMyIntroRequirementAction with NOT_REQUIRED when unchecked", async () => {
    mocks.setMyIntroRequirementAction.mockResolvedValue({ ok: true });
    renderRoom({ myIntroStance: "REQUIRED" });
    const checkbox = screen.getByRole("checkbox", { name: /חובה שתהיה פגישת היכרות בוידאו/ });

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(mocks.setMyIntroRequirementAction).toHaveBeenCalledWith({ connectionId: "connection-1", stance: "NOT_REQUIRED" }),
    );
  });

  it("shows no mismatch banner when both sides agree, or neither has declared a stance", () => {
    renderRoom({ myIntroStance: "REQUIRED", otherPartyIntroStance: "REQUIRED" });
    expect(screen.queryByText(/לא מעוניין\/ת להמשיך בחיבור/)).not.toBeInTheDocument();
    expect(screen.queryByText(/אבל הצד השני סימן\/ה שזה לא הכרחי/)).not.toBeInTheDocument();
  });

  it("shows the banner, worded for the non-requiring side, when I don't require it but the other side does", () => {
    renderRoom({ myIntroStance: "NOT_REQUIRED", otherPartyIntroStance: "REQUIRED" });
    expect(
      screen.getByText("הצד השני לא מעוניין/ת להמשיך בחיבור כל עוד לא הייתה פגישת היכרות בוידאו."),
    ).toBeInTheDocument();
  });

  it("shows the banner, worded for the requiring side, when I require it but the other side doesn't", () => {
    renderRoom({ myIntroStance: "REQUIRED", otherPartyIntroStance: "NOT_REQUIRED" });
    expect(
      screen.getByText("מבחינתך חובה פגישת היכרות בוידאו, אבל הצד השני סימן/ה שזה לא הכרחי מבחינתו/ה."),
    ).toBeInTheDocument();
  });

  it("keeps chat and other panels fully interactive despite a mismatch (informational only, no gating)", () => {
    renderRoom({ myIntroStance: "REQUIRED", otherPartyIntroStance: "NOT_REQUIRED" });
    const input = screen.getByLabelText("כתיבת הודעה");
    expect(input).toBeInTheDocument();
    expect(input).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "הצעת פגישת היכרות בווידאו" })).toBeInTheDocument();
  });
});

describe("ConnectionRoom — suggested session guide picker (browse and choose)", () => {
  it("shows category buttons when no guide is selected yet", () => {
    renderRoom();
    expect(screen.getByRole("button", { name: "פגישת היכרות בווידאו" })).toBeInTheDocument();
  });

  it("fetches and lists guide options for a category on click, without auto-picking one", async () => {
    mocks.listGuideOptionsAction.mockResolvedValue({
      ok: true,
      guides: [
        { id: "g1", title: "מדריך א", purpose: "מטרה א", suggestedDurationMinutes: 15 },
        { id: "g2", title: "מדריך ב", purpose: "מטרה ב", suggestedDurationMinutes: 30 },
      ],
    });
    renderRoom();

    fireEvent.click(screen.getByRole("button", { name: "פגישת היכרות בווידאו" }));

    await screen.findByText("מדריך א");
    expect(screen.getByText("מדריך ב")).toBeInTheDocument();
    expect(mocks.listGuideOptionsAction).toHaveBeenCalledWith({ connectionId: "connection-1", category: "intro" });
    expect(mocks.pickGuideForConnectionAction).not.toHaveBeenCalled();
  });

  it("collapses the guide list when the same category button is clicked again", async () => {
    mocks.listGuideOptionsAction.mockResolvedValue({
      ok: true,
      guides: [{ id: "g1", title: "מדריך א", purpose: "מטרה א", suggestedDurationMinutes: 15 }],
    });
    renderRoom();
    const categoryButton = screen.getByRole("button", { name: "פגישת היכרות בווידאו" });

    fireEvent.click(categoryButton);
    await screen.findByText("מדריך א");
    fireEvent.click(categoryButton);

    expect(screen.queryByText("מדריך א")).not.toBeInTheDocument();
  });

  it("shows an empty-state message when the category has no published guides", async () => {
    mocks.listGuideOptionsAction.mockResolvedValue({ ok: true, guides: [] });
    renderRoom();

    fireEvent.click(screen.getByRole("button", { name: "פגישת היכרות בווידאו" }));

    expect(await screen.findByText("אין עדיין מערכי שיעור בקטגוריה הזו")).toBeInTheDocument();
  });

  it("selects a specific guide by id via selectGuideForConnectionAction, then refreshes and closes the list", async () => {
    mocks.listGuideOptionsAction.mockResolvedValue({
      ok: true,
      guides: [{ id: "g1", title: "מדריך א", purpose: "מטרה א", suggestedDurationMinutes: 15 }],
    });
    mocks.selectGuideForConnectionAction.mockResolvedValue({ ok: true });
    renderRoom();

    fireEvent.click(screen.getByRole("button", { name: "פגישת היכרות בווידאו" }));
    await screen.findByText("מדריך א");
    fireEvent.click(screen.getByRole("button", { name: "בחר/י" }));

    await waitFor(() =>
      expect(mocks.selectGuideForConnectionAction).toHaveBeenCalledWith({ connectionId: "connection-1", guideId: "g1" }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("shows an error and keeps the panel open when listing guide options fails", async () => {
    mocks.listGuideOptionsAction.mockResolvedValue({ ok: false, error: "משהו השתבש" });
    renderRoom();

    fireEvent.click(screen.getByRole("button", { name: "פגישת היכרות בווידאו" }));

    expect(await screen.findByText("משהו השתבש")).toBeInTheDocument();
  });

  it("still offers a random reroll and clear once a guide is already selected", () => {
    renderRoom({
      selectedGuide: {
        id: "g1",
        title: "מדריך נבחר",
        purpose: "מטרה",
        category: "intro",
        suggestedDurationMinutes: 20,
        steps: [],
      },
    });

    expect(screen.getByRole("button", { name: "הצעה אחרת מאותה קטגוריה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הסרת המבנה המוצע" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "פגישת היכרות בווידאו" })).not.toBeInTheDocument();
  });
});
