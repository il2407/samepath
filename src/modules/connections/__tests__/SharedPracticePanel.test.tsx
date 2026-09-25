// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SharedPracticePanel } from "../SharedPracticePanel";
import { ProposeContent } from "../ProposeContent";
import type { SharedPractice } from "../content";
const mocks = vi.hoisted(() => ({
  change: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}));
vi.mock("../content-actions", () => ({ changePracticeAction: mocks.change }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const practice: SharedPractice = {
  revision: 3,
  proposedBy: "a",
  agreed: {
    key: "template:coding",
    title: "תרגול קוד",
    purpose: "קוד",
    href: "/app/guides?category=coding",
  },
  pending: {
    key: "template:system-design",
    title: "עיצוב מערכות",
    purpose: "מערכות",
    href: "/app/guides?category=system-design",
  },
};
describe("shared practice UI", () => {
  it("shows the proposer a waiting state alongside the still-valid agreement", () => {
    render(
      <SharedPracticePanel
        connectionId="connection"
        practice={practice}
        userId="a"
        active
      />,
    );
    expect(
      screen.queryByRole("button", { name: "מתאים לי" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("ממתינים לאישור התוכן מהצד השני"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "פתיחת מערך המפגש" }),
    ).toHaveAttribute(
      "href",
      "/app/guides?category=coding&connection=connection",
    );
  });
  it("lets the recipient approve the exact revision and reports failures", async () => {
    mocks.change.mockResolvedValue({ ok: false, error: "התוכן עודכן בינתיים" });
    render(
      <SharedPracticePanel
        connectionId="connection"
        practice={practice}
        userId="b"
        active
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "מתאים לי" }));
    await waitFor(() =>
      expect(mocks.change).toHaveBeenCalledWith({
        connectionId: "connection",
        revision: 3,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "התוכן עודכן בינתיים",
    );
  });
  it("proposes to the contextual connection without asking to choose a person again", async () => {
    mocks.change.mockResolvedValue({ ok: true });
    render(
      <ProposeContent
        contentKey="template:coding"
        connectionId="c"
        connections={[
          { id: "c", name: "דנה", revision: 4 },
          { id: "d", name: "יואב", revision: 0 },
        ]}
      />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "הציעו תוכן למפגש" }));
    await waitFor(() =>
      expect(mocks.change).toHaveBeenCalledWith({
        connectionId: "c",
        key: "template:coding",
        revision: 4,
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/app/connections/c#practice");
  });
  it("lets a visitor choose a connection when browsing without context", () => {
    render(
      <ProposeContent
        contentKey="template:coding"
        connections={[
          { id: "c", name: "דנה", revision: 0 },
          { id: "d", name: "יואב", revision: 0 },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "הציעו לחיבור" }));
    expect(
      screen.getByRole("button", { name: "הציעו תוכן למפגש" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "d" } });
    expect(
      screen.getByRole("button", { name: "הציעו תוכן למפגש" }),
    ).toBeEnabled();
  });
});
