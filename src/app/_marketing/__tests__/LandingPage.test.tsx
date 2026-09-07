// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import LandingPage from "@/app/page";

/**
 * jsdom doesn't implement IntersectionObserver (needed by the shared `Reveal`
 * wrapper via framer-motion's `whileInView`, used throughout every section)
 * or matchMedia (needed by useReducedMotion and the Header's sticky-scroll
 * state). Stub both so the full composed page — the actual default export
 * of src/app/page.tsx, not a reimplementation of it — can mount in a plain
 * DOM test the same way it's described in Next's own Vitest guide
 * (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md).
 */
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LandingPage", () => {
  it("composes every marketing section without crashing, with exactly one h1", () => {
    render(<LandingPage />);

    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
  });

  it("every /register call-to-action on the page links to the real route", () => {
    render(<LandingPage />);

    // Several sections repeat this exact CTA copy (Header, Hero, HowItWorks bottom
    // CTA, Pricing, FinalCta, MobileCta) — every one of them must resolve to the
    // real /register route (verified to exist at src/app/register/page.tsx), never
    // a typo'd or stale path.
    const registerLinks = screen
      .getAllByRole("link")
      .filter((link) => link.textContent?.includes("מצאו לי אנשים") || link.textContent?.includes("הצטרפות"));

    expect(registerLinks.length).toBeGreaterThan(0);
    for (const link of registerLinks) {
      expect(link.getAttribute("href")).toBe("/register");
    }
  });

  it("does not link anywhere to the removed, nonexistent /privacy or /terms routes", () => {
    render(<LandingPage />);

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).not.toContain("/privacy");
    expect(hrefs).not.toContain("/terms");
  });
});
