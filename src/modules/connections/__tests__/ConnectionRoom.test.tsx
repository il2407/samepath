// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { ConnectionRoom } from "@/modules/connections/ConnectionRoom";
import type { ConnectionDetail } from "@/modules/connections/service";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  sendMessageAction: vi.fn(),
  markMeetingAction: vi.fn(),
  endConnectionAction: vi.fn(),
  blockConnectionAction: vi.fn(),
  reportConnectionAction: vi.fn(),
  attachMeetLinkForConnectionAction: vi.fn(),
  generateMeetLinkForConnectionAction: vi.fn(),
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
  attachMeetLinkForConnectionAction: mocks.attachMeetLinkForConnectionAction,
  generateMeetLinkForConnectionAction: mocks.generateMeetLinkForConnectionAction,
}));

const CURRENT_USER_ID = "user-me";
const OTHER_USER_ID = "user-other";

const baseOtherParty: ConnectionDetail["otherParty"] = {
  professionalField: "הנדסת תוכנה",
  seniorityBand: "בכיר/ה",
  targetRoles: [],
  skillsAndDomains: [],
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
  linkedInUrl: null,
  yearsOfExperience: null,
};

function makeConnection(overrides: Partial<ConnectionDetail> = {}): ConnectionDetail {
  return {
    id: "connection-1",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    otherParty: baseOtherParty,
    otherPartyDisplayName: "דנה כהן",
    otherPartyPhotoDataUrl: null,
    otherPartyPublishedInterviewCount: 0,
    messages: [],
    meetingStatuses: [],
    myTimezone: "Asia/Jerusalem",
    selectedGuide: null,
    mySessionTypes: [],
    otherPartySessionTypes: [],
    myIntroStance: null,
    otherPartyIntroStance: null,
    meetLink: null,
    ...overrides,
  };
}

function renderRoom(connectionOverrides: Partial<ConnectionDetail> = {}, hasGoogleMeetConnected = false) {
  return render(
    <ConnectionRoom
      connection={makeConnection(connectionOverrides)}
      currentUserId={CURRENT_USER_ID}
      hasGoogleMeetConnected={hasGoogleMeetConnected}
    />,
  );
}

function openMoreOptions() {
  fireEvent.click(screen.getByRole("button", { name: "אפשרויות נוספות" }));
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

describe("ConnectionRoom — Google Meet link (simplified connection page)", () => {
  it("shows a Meet link as a clickable, LTR, break-all link when one is already attached", () => {
    renderRoom({ meetLink: "https://meet.google.com/abc-defg-hij" });
    const link = screen.getByRole("link", { name: "https://meet.google.com/abc-defg-hij" });
    expect(link).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    expect(link).toHaveAttribute("dir", "ltr");
  });

  it("offers a Google connect CTA (not a generate button) when the user has no Google Meet grant", () => {
    renderRoom({}, false);
    const connectLink = screen.getByRole("link", { name: "התחברות ל-Google ליצירת קישור Meet" });
    expect(connectLink).toHaveAttribute(
      "href",
      "/api/auth/google-meet/start?returnTo=%2Fapp%2Fconnections%2Fconnection-1",
    );
    expect(screen.queryByRole("button", { name: "יצירת קישור Google Meet" })).not.toBeInTheDocument();
  });

  it("calls generateMeetLinkForConnectionAction with the connection id when the user has a Google Meet grant", async () => {
    mocks.generateMeetLinkForConnectionAction.mockResolvedValue({ ok: true });
    renderRoom({}, true);

    fireEvent.click(screen.getByRole("button", { name: "יצירת קישור Google Meet" }));

    await waitFor(() =>
      expect(mocks.generateMeetLinkForConnectionAction).toHaveBeenCalledWith({ connectionId: "connection-1" }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("surfaces an error from generateMeetLinkForConnectionAction without crashing", async () => {
    mocks.generateMeetLinkForConnectionAction.mockResolvedValue({ ok: false, error: "יצירת קישור הפגישה נכשלה, נסו שוב" });
    renderRoom({}, true);

    fireEvent.click(screen.getByRole("button", { name: "יצירת קישור Google Meet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("יצירת קישור הפגישה נכשלה, נסו שוב");
  });

  it("attaches a manually-pasted link via attachMeetLinkForConnectionAction and refreshes", async () => {
    mocks.attachMeetLinkForConnectionAction.mockResolvedValue({ ok: true });
    renderRoom();

    const input = screen.getByLabelText("קישור ל-Google Meet");
    fireEvent.change(input, { target: { value: "https://meet.google.com/xyz-abcd-efg" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

    await waitFor(() =>
      expect(mocks.attachMeetLinkForConnectionAction).toHaveBeenCalledWith({
        connectionId: "connection-1",
        meetLink: "https://meet.google.com/xyz-abcd-efg",
      }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("surfaces an error from attachMeetLinkForConnectionAction without crashing", async () => {
    mocks.attachMeetLinkForConnectionAction.mockResolvedValue({ ok: false, error: "קישור לא תקין" });
    renderRoom();

    const input = screen.getByLabelText("קישור ל-Google Meet");
    fireEvent.change(input, { target: { value: "https://not-a-meet-link.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("קישור לא תקין");
  });

  it("does not render the Meet link panel once the connection is no longer ACTIVE", () => {
    renderRoom({ status: "ENDED" });
    expect(screen.queryByText("שיחת וידאו")).not.toBeInTheDocument();
  });
});

describe("ConnectionRoom — more options (end / block / report / mark completed)", () => {
  it("keeps end/block/report/mark-completed hidden until 'אפשרויות נוספות' is opened", () => {
    renderRoom();
    expect(screen.queryByRole("button", { name: "סיום החיבור" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "חסימה" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "דיווח" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "סימון מפגש כהושלם" })).not.toBeInTheDocument();
  });

  it("shows end/block/report/mark-completed once opened", () => {
    renderRoom();
    openMoreOptions();
    expect(screen.getByRole("button", { name: "סיום החיבור" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "חסימה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "דיווח" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "סימון מפגש כהושלם" })).toBeInTheDocument();
  });

  it("calls endConnectionAction and refreshes on success", async () => {
    mocks.endConnectionAction.mockResolvedValue({ ok: true });
    renderRoom();
    openMoreOptions();

    fireEvent.click(screen.getByRole("button", { name: "סיום החיבור" }));

    await waitFor(() => expect(mocks.endConnectionAction).toHaveBeenCalledWith("connection-1"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("calls blockConnectionAction and refreshes on success", async () => {
    mocks.blockConnectionAction.mockResolvedValue({ ok: true });
    renderRoom();
    openMoreOptions();

    fireEvent.click(screen.getByRole("button", { name: "חסימה" }));

    await waitFor(() => expect(mocks.blockConnectionAction).toHaveBeenCalledWith("connection-1"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("calls markMeetingAction with a completedAt timestamp and refreshes", async () => {
    mocks.markMeetingAction.mockResolvedValue({ ok: true });
    renderRoom();
    openMoreOptions();

    fireEvent.click(screen.getByRole("button", { name: "סימון מפגש כהושלם" }));

    await waitFor(() => expect(mocks.markMeetingAction).toHaveBeenCalled());
    const call = mocks.markMeetingAction.mock.calls[0][0];
    expect(call.connectionId).toBe("connection-1");
    expect(typeof call.completedAt).toBe("string");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("submits a report with the chosen category and description, and refreshes on success", async () => {
    mocks.reportConnectionAction.mockResolvedValue({ ok: true });
    renderRoom();
    openMoreOptions();
    fireEvent.click(screen.getByRole("button", { name: "דיווח" }));

    const textarea = screen.getByPlaceholderText("פרטים");
    fireEvent.change(textarea, { target: { value: "התנהגות לא הולמת" } });
    fireEvent.click(screen.getByRole("button", { name: "שליחת דיווח" }));

    await waitFor(() =>
      expect(mocks.reportConnectionAction).toHaveBeenCalledWith({
        connectionId: "connection-1",
        category: "OTHER",
        description: "התנהגות לא הולמת",
      }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("surfaces an error and keeps the report form open when reportConnectionAction fails (e.g. empty description)", async () => {
    mocks.reportConnectionAction.mockResolvedValue({ ok: false, error: "נא לפרט" });
    renderRoom();
    openMoreOptions();
    fireEvent.click(screen.getByRole("button", { name: "דיווח" }));

    fireEvent.click(screen.getByRole("button", { name: "שליחת דיווח" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("נא לפרט");
    expect(screen.getByPlaceholderText("פרטים")).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("does not render the more-options toggle once the connection is no longer ACTIVE", () => {
    renderRoom({ status: "ENDED" });
    expect(screen.queryByRole("button", { name: "אפשרויות נוספות" })).not.toBeInTheDocument();
  });
});

describe("ConnectionRoom — post-match LinkedIn reveal (backlog item 11/12, revised again: automatic, no opt-in)", () => {
  it("shows a clear 'not provided' fallback instead of a link when the other party never entered a URL", () => {
    renderRoom();
    expect(screen.queryByText("פרופיל LinkedIn")).not.toBeInTheDocument();
    expect(screen.getByText("קישור LinkedIn לא סופק")).toBeInTheDocument();
  });

  it("shows a LinkedIn link to the other party's profile automatically once a URL is on their DTO", () => {
    renderRoom({
      otherParty: { ...baseOtherParty, linkedInUrl: "https://linkedin.com/in/dana" },
    });
    const link = screen.getByRole("link", { name: "פרופיל LinkedIn ↗" });
    expect(link).toHaveAttribute("href", "https://linkedin.com/in/dana");
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("ConnectionRoom — post-match full name / workplace, shown automatically with a clear fallback when missing", () => {
  it("shows the other party's real full name and workplace once connected", () => {
    renderRoom({ otherParty: { ...baseOtherParty, fullName: "דנה כהן", company: "Acme Inc" } });
    expect(screen.getByText("דנה כהן")).toBeInTheDocument();
    expect(screen.getByText("Acme Inc", { exact: false })).toBeInTheDocument();
  });

  it("shows a clear 'not provided' fallback instead of fabricating a name or workplace", () => {
    renderRoom({ otherParty: { ...baseOtherParty, fullName: null, company: null } });
    expect(screen.getByText("שם מלא לא סופק")).toBeInTheDocument();
    expect(screen.getByText("מעסיק לא צוין", { exact: false })).toBeInTheDocument();
  });
});
