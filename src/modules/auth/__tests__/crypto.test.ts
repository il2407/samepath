import { describe, expect, it } from "vitest";
import { generateNumericCode, generateToken, hashSecret } from "@/modules/auth/crypto";

describe("generateToken", () => {
  it("produces distinct, URL-safe, high-entropy tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(30);
  });
});

describe("generateNumericCode", () => {
  it("produces a 6-digit, zero-padded numeric code by default", () => {
    const code = generateNumericCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("supports a custom digit count", () => {
    const code = generateNumericCode(4);
    expect(code).toMatch(/^\d{4}$/);
  });

  it("produces different codes across calls (not a constant)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateNumericCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("hashSecret", () => {
  it("is deterministic for the same input", () => {
    expect(hashSecret("123456")).toBe(hashSecret("123456"));
  });

  it("differs for different inputs", () => {
    expect(hashSecret("123456")).not.toBe(hashSecret("654321"));
  });

  it("never returns the original value", () => {
    expect(hashSecret("123456")).not.toBe("123456");
  });
});
