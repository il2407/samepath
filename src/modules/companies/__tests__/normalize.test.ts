import { describe, expect, it } from "vitest";
import { editDistance, matchQuality, normalizeCompanyName } from "@/modules/companies/normalize";

describe("normalizeCompanyName", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeCompanyName("  Google   Israel  ")).toBe("google israel");
  });

  it("strips common English legal suffixes", () => {
    expect(normalizeCompanyName("Acme Inc")).toBe("acme");
    expect(normalizeCompanyName("Acme Ltd.")).toBe("acme");
    expect(normalizeCompanyName("Acme LLC")).toBe("acme");
  });

  it("strips the Hebrew legal suffix", () => {
    expect(normalizeCompanyName('גוגל ישראל בע"מ')).toBe("גוגל ישראל");
  });

  it("treats a local legal entity and the global brand as equal once normalized", () => {
    expect(normalizeCompanyName("Google Israel Ltd.")).toBe(normalizeCompanyName("google israel"));
  });
});

describe("editDistance", () => {
  it("is zero for identical strings", () => {
    expect(editDistance("google", "google")).toBe(0);
  });

  it("counts a single substitution", () => {
    expect(editDistance("gogle", "google")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "")).toBe(3);
  });
});

describe("matchQuality", () => {
  it("is exact for identical normalized names", () => {
    expect(matchQuality("google", "google")).toBe("exact");
  });

  it("is partial for a substring relationship", () => {
    expect(matchQuality("google", "google israel")).toBe("partial");
  });

  it("is close for a small typo", () => {
    expect(matchQuality("microsooft", "microsoft")).toBe("close");
  });

  it("is none for unrelated names", () => {
    expect(matchQuality("google", "amazon")).toBe("none");
  });
});
