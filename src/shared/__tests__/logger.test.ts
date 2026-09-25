import { describe, expect, it } from "vitest";
import { formatLogLine, redact } from "@/shared/logger";

describe("redact", () => {
  it("redacts sensitive keys at any depth, keeps IDs", () => {
    expect(
      redact({ userId: "u1", email: "a@b.co", user: { displayName: "Dana", password: "x", sessionToken: "t" }, count: 3 }),
    ).toEqual({ userId: "u1", email: "[redacted]", user: { displayName: "[redacted]", password: "[redacted]", sessionToken: "[redacted]" }, count: 3 });
  });

  it("scrubs email addresses and bearer tokens inside strings", () => {
    expect(redact("failed to send to dana.levi+x@example.co.il")).toBe("failed to send to [email]");
    expect(redact("header Bearer abc.def-123")).toBe("header Bearer [redacted]");
  });

  it("serializes errors (message, stack, code, cause) with redaction", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    const error = new Error("550 mailbox a@b.co unavailable", { cause });
    const out = redact(error) as Record<string, unknown>;
    expect(out.name).toBe("Error");
    expect(out.message).toBe("550 mailbox [email] unavailable");
    expect(String(out.stack)).not.toContain("a@b.co");
    expect(out.cause).toMatchObject({ message: "connect ECONNREFUSED", code: "ECONNREFUSED" });
  });

  it("stops at a depth limit instead of recursing forever", () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let i = 0; i < 10; i++) cursor = cursor.next = {} as Record<string, unknown>;
    expect(JSON.stringify(redact(deep))).toContain("[truncated]");
  });
});

describe("formatLogLine", () => {
  it("emits one JSON object with level, time, msg and redacted context", () => {
    const line = formatLogLine("error", "mail to a@b.co failed", { uploadId: "up1", token: "secret" });
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: "error", msg: "mail to [email] failed", uploadId: "up1", token: "[redacted]" });
    expect(new Date(parsed.time).toString()).not.toBe("Invalid Date");
  });
});
