import { describe, expect, it } from "vitest";
import { validateMeetLink } from "@/modules/connections/meeting-link";

describe("validateMeetLink", () => {
  it("accepts a real-shaped Google Meet link", () => {
    const result = validateMeetLink("https://meet.google.com/abc-defg-hij");
    expect(result).toEqual({ ok: true, url: "https://meet.google.com/abc-defg-hij" });
  });

  it("accepts a Meet link with trailing query params", () => {
    const result = validateMeetLink("https://meet.google.com/abc-defg-hij?authuser=0");
    expect(result.ok).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = validateMeetLink("  https://meet.google.com/abc-defg-hij  ");
    expect(result).toEqual({ ok: true, url: "https://meet.google.com/abc-defg-hij" });
  });

  it("rejects an empty string", () => {
    const result = validateMeetLink("   ");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-URL string", () => {
    const result = validateMeetLink("not a url at all");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-https scheme", () => {
    expect(validateMeetLink("http://meet.google.com/abc-defg-hij").ok).toBe(false);
    expect(validateMeetLink("javascript:alert(1)").ok).toBe(false);
    expect(validateMeetLink("ftp://meet.google.com/abc-defg-hij").ok).toBe(false);
  });

  it("rejects a non-Meet domain, even a plausible-looking one", () => {
    expect(validateMeetLink("https://meet.google.com.evil.example/abc-defg-hij").ok).toBe(false);
    expect(validateMeetLink("https://zoom.us/j/123456789").ok).toBe(false);
    expect(validateMeetLink("https://google.com/abc-defg-hij").ok).toBe(false);
  });

  it("rejects a Meet-domain URL with the wrong path shape", () => {
    expect(validateMeetLink("https://meet.google.com/").ok).toBe(false);
    expect(validateMeetLink("https://meet.google.com/not-a-real-code").ok).toBe(false);
    expect(validateMeetLink("https://meet.google.com/abcdefghij").ok).toBe(false);
    expect(validateMeetLink("https://meet.google.com/ab-cdef-ghi").ok).toBe(false);
  });

  it("accepts uppercase letters in the code but returns the original casing", () => {
    const result = validateMeetLink("https://meet.google.com/ABC-DEFG-HIJ");
    expect(result).toEqual({ ok: true, url: "https://meet.google.com/ABC-DEFG-HIJ" });
  });
});
