import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/modules/auth/password";

describe("hashPassword / verifyPassword", () => {
  it("verifies the correct password against its own hash", async () => {
    const stored = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", stored)).resolves.toBe(false);
  });

  it("never stores the password in plaintext", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored).not.toContain("correct horse battery staple");
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    await expect(verifyPassword("same password", a)).resolves.toBe(true);
    await expect(verifyPassword("same password", b)).resolves.toBe(true);
  });

  it("rejects a malformed stored value instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-valid-stored-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });
});
