// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Hero } from "../Hero";

/**
 * jsdom doesn't implement IntersectionObserver, which the shared `Reveal`
 * scroll-reveal wrapper (used throughout every marketing section, including
 * Hero) depends on via framer-motion's `whileInView` — without this stub,
 * mounting any Reveal-wrapped component throws "IntersectionObserver is not
 * defined" regardless of motion preference.
 */
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Hero", () => {
  it("renders the headline and a primary CTA linking to the real /register route", () => {
    mockMatchMedia(false);
    render(<Hero />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("במקום לדמיין איך ייראה ראיון העבודה הבא");

    const primaryCta = screen.getByRole("link", { name: "מצאו לי אנשים במסלול שלי" });
    expect(primaryCta.getAttribute("href")).toBe("/register");
  });

  it("renders a secondary CTA anchored to the real #how-it-works section", () => {
    mockMatchMedia(false);
    render(<Hero />);

    const secondaryCta = screen.getByRole("link", { name: "לראות איך זה עובד" });
    expect(secondaryCta.getAttribute("href")).toBe("#how-it-works");
  });

  it("renders without crashing when the OS requests reduced motion", () => {
    mockMatchMedia(true);
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "מצאו לי אנשים במסלול שלי" })).toBeTruthy();
  });

  it("renders without crashing when matchMedia is entirely unavailable", () => {
    // Some environments have no matchMedia at all (this is in fact jsdom's own
    // default) — framer-motion's useReducedMotion() must fall back gracefully
    // rather than throw when the media query can't be evaluated at all.
    vi.stubGlobal("matchMedia", undefined);
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});
