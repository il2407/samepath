import { describe, expect, it } from "vitest";
import { isValidEmail, isValidPassword, normalizeEmail } from "@/modules/auth/validation";

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeEmail("  Alice@Example.COM  ")).toBe("alice@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary personal addresses", () => {
    expect(isValidEmail("alice@example.com")).toBe(true);
    expect(isValidEmail("a.b+c@sub.example.co.il")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects addresses over the 254-character limit", () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect(isValidEmail(long)).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("accepts passwords of 8-200 characters", () => {
    expect(isValidPassword("12345678")).toBe(true);
    expect(isValidPassword("a".repeat(200))).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(isValidPassword("1234567")).toBe(false);
    expect(isValidPassword("")).toBe(false);
  });

  it("rejects passwords longer than 200 characters", () => {
    expect(isValidPassword("a".repeat(201))).toBe(false);
  });
});
