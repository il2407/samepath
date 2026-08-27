import { describe, expect, it } from "vitest";
import {
  findLikelyDuplicates,
  isLikelyDuplicateQuestion,
  scanForProhibitedContent,
  wordSetSimilarity,
} from "@/modules/interviews/duplicate-detection";

describe("wordSetSimilarity / isLikelyDuplicateQuestion", () => {
  it("treats identical questions as fully similar", () => {
    expect(wordSetSimilarity("What is a database index?", "What is a database index?")).toBe(1);
  });

  it("treats lightly reworded questions as likely duplicates", () => {
    expect(
      isLikelyDuplicateQuestion(
        "Walk me through how you would design a rate limiter",
        "How would you design a rate limiter",
      ),
    ).toBe(true);
  });

  it("treats unrelated questions as not duplicates", () => {
    expect(isLikelyDuplicateQuestion("What is a database index?", "Tell me about your biggest failure.")).toBe(
      false,
    );
  });

  it("is case- and punctuation-insensitive", () => {
    expect(wordSetSimilarity("What is REST?", "what is rest")).toBe(1);
  });
});

describe("findLikelyDuplicates", () => {
  it("returns every near-duplicate from the existing set", () => {
    const dupes = findLikelyDuplicates("How would you design a URL shortener?", [
      "How would you design a URL shortener service?",
      "Tell me about a conflict with a coworker.",
    ]);
    expect(dupes).toHaveLength(1);
  });
});

describe("scanForProhibitedContent", () => {
  it("flags an email address", () => {
    expect(scanForProhibitedContent("contact me at jane@example.com").flagged).toBe(true);
  });

  it("flags a phone number", () => {
    expect(scanForProhibitedContent("call 050-1234567 if interested").flagged).toBe(true);
  });

  it("flags a URL", () => {
    expect(scanForProhibitedContent("see https://example.com/profile").flagged).toBe(true);
  });

  it("does not flag ordinary interview-experience text", () => {
    const result = scanForProhibitedContent(
      "The process had three stages: a recruiter screen, a coding round, and a system design discussion.",
    );
    expect(result.flagged).toBe(false);
    expect(result.reasons).toEqual([]);
  });
});
