import { readFile } from "node:fs/promises";

export function uniqueTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reads the 6-digit OTP the app just "sent" for `email` out of the dev
 * server's own stdout, which playwright.config.ts already pipes to
 * E2E_SERVER_LOG (default /tmp/samepath-e2e-server.log) — the same file a
 * human would tail to debug a run. This only works because MAIL_ADAPTER is
 * "console" for local/e2e use (see notifications/mailer.ts); there's no
 * DB-side way to recover the code instead, since EmailVerification only
 * stores a salted hash of it (see auth/service.ts).
 */
export async function readVerificationCode(email: string): Promise<string> {
  const logPath = process.env.E2E_SERVER_LOG ?? "/tmp/samepath-e2e-server.log";
  const pattern = new RegExp(`to:\\s+${escapeRegExp(email)}[\\s\\S]*?קוד האימות שלכם: (\\d{6})`, "g");

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    let content = "";
    try {
      content = await readFile(logPath, "utf8");
    } catch {
      // Log file not created yet — keep polling until the deadline.
    }
    const matches = [...content.matchAll(pattern)];
    const last = matches.at(-1);
    if (last) return last[1];
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for a verification code for ${email} in ${logPath}`);
}
