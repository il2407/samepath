// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AppNav } from "../AppNav";

const route = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(() => { cleanup(); route.pathname = "/app"; });

function mobileNav() {
  return within(screen.getByRole("navigation", { name: "ניווט לנייד" }));
}

describe("mobile navigation", () => {
  it("highlights the parent destination for a connection room", () => {
    route.pathname = "/app/connections/example";
    render(<AppNav />);
    expect(mobileNav().getByRole("link", { name: "חיבורים" })).toHaveAttribute("aria-current", "page");
    expect(mobileNav().getByRole("link", { name: "ראשי" })).not.toHaveAttribute("aria-current");
  });

  it("opens additional destinations and restores focus on Escape", () => {
    render(<AppNav />);
    const toggle = mobileNav().getByRole("button", { name: "עוד" });
    fireEvent.click(toggle);
    const menu = screen.getByRole("navigation", { name: "ניווט נוסף" });
    expect(within(menu).getByRole("link", { name: "מי אנחנו" })).toHaveFocus();
    expect(within(menu).getByRole("link", { name: "הגדרות" })).toHaveAttribute("href", "/app/settings");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "ניווט נוסף" })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("dismisses on outside interaction and route changes", () => {
    const view = render(<AppNav />);
    fireEvent.click(mobileNav().getByRole("button", { name: "עוד" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("navigation", { name: "ניווט נוסף" })).not.toBeInTheDocument();
    fireEvent.click(mobileNav().getByRole("button", { name: "עוד" }));
    route.pathname = "/app/settings/privacy";
    view.rerender(<AppNav />);
    expect(screen.queryByRole("navigation", { name: "ניווט נוסף" })).not.toBeInTheDocument();
  });
});
