import { describe, expect, it } from "vitest";
import { generateToken, hashSecret } from "@/modules/auth/crypto";

describe("generateToken", () => {
  it("produces distinct, URL-safe, high-entropy tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(30);
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
