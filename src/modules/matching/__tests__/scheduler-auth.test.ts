import { describe, expect, it } from "vitest";
import { extractProvidedSecret, isAuthorizedRequest, safeEqual } from "@/modules/matching/scheduler-auth";

const REAL_SECRET = "correct-horse-battery-staple-32-bytes-plus";

function headersWith(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("extractProvidedSecret", () => {
  it("reads a Bearer token from the Authorization header", () => {
    expect(extractProvidedSecret(headersWith({ authorization: `Bearer ${REAL_SECRET}` }))).toBe(REAL_SECRET);
  });

  it("is case-insensitive about the 'Bearer' scheme", () => {
    expect(extractProvidedSecret(headersWith({ authorization: `bearer ${REAL_SECRET}` }))).toBe(REAL_SECRET);
  });

  it("falls back to the x-job-scheduler-secret header when there is no Authorization header", () => {
    expect(extractProvidedSecret(headersWith({ "x-job-scheduler-secret": REAL_SECRET }))).toBe(REAL_SECRET);
  });

  it("prefers the Authorization header over x-job-scheduler-secret when both are present", () => {
    const headers = headersWith({
      authorization: `Bearer from-auth-header`,
      "x-job-scheduler-secret": "from-custom-header",
    });
    expect(extractProvidedSecret(headers)).toBe("from-auth-header");
  });

  it("returns null when neither header is present", () => {
    expect(extractProvidedSecret(headersWith({}))).toBeNull();
  });

  it("returns null for an Authorization header that isn't the Bearer scheme", () => {
    expect(extractProvidedSecret(headersWith({ authorization: "Basic dXNlcjpwYXNz" }))).toBeNull();
  });
});

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual(REAL_SECRET, REAL_SECRET)).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(safeEqual("a".repeat(20), "b".repeat(20))).toBe(false);
  });

  it("returns false (not throws) for strings of different lengths", () => {
    expect(safeEqual("short", "a-much-longer-secret-value")).toBe(false);
  });

  it("returns false for an empty provided value against a real secret", () => {
    expect(safeEqual("", REAL_SECRET)).toBe(false);
  });
});

describe("isAuthorizedRequest", () => {
  it("authorizes a request with the correct secret via Authorization: Bearer", () => {
    const headers = headersWith({ authorization: `Bearer ${REAL_SECRET}` });
    expect(isAuthorizedRequest(headers, REAL_SECRET)).toBe(true);
  });

  it("authorizes a request with the correct secret via x-job-scheduler-secret", () => {
    const headers = headersWith({ "x-job-scheduler-secret": REAL_SECRET });
    expect(isAuthorizedRequest(headers, REAL_SECRET)).toBe(true);
  });

  it("rejects a request with the wrong secret", () => {
    const headers = headersWith({ authorization: `Bearer wrong-secret` });
    expect(isAuthorizedRequest(headers, REAL_SECRET)).toBe(false);
  });

  it("rejects a request with no secret header at all", () => {
    expect(isAuthorizedRequest(headersWith({}), REAL_SECRET)).toBe(false);
  });

  it("fails closed when JOB_SCHEDULER_SECRET is not configured (empty string), even with a plausible-looking header", () => {
    const headers = headersWith({ authorization: `Bearer anything-at-all` });
    expect(isAuthorizedRequest(headers, "")).toBe(false);
  });

  it("rejects an empty provided secret even if the configured secret were somehow also empty", () => {
    expect(isAuthorizedRequest(headersWith({ authorization: "Bearer " }), "")).toBe(false);
  });
});
