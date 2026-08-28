import { readFileSync } from "node:fs";

const LOG_PATH = process.env.E2E_SERVER_LOG ?? "/tmp/samepath-e2e-server.log";
const MAIL_HEADER = "── ✉️  MAIL (console adapter) ─────────────────────────────";

function readCodeFromLog(email: string): string | null {
  let log: string;
  try {
    log = readFileSync(LOG_PATH, "utf8");
  } catch {
    return null;
  }

  const blocks = log.split(MAIL_HEADER);
  for (let i = blocks.length - 1; i >= 1; i--) {
    const block = blocks[i];
    if (!block.includes(`to:      ${email}`)) continue;
    // Skip header lines — a timestamp-based test email address can itself
    // contain a run of 6 digits that would otherwise be mistaken for the
    // code.
    const bodyLines = block.split("\n").filter((l) => !l.startsWith("to:") && !l.startsWith("subject:"));
    const match = bodyLines.join("\n").match(/\b(\d{6})\b/);
    if (match) return match[1];
  }
  return null;
}

/**
 * The dev server's default MAIL_ADAPTER=console prints every "sent" email
 * to its own stdout instead of an inbox — see
 * src/modules/notifications/mailer.ts. This reads the verification code
 * back out of that log the same way a human running `pnpm dev` locally
 * would read it off their own terminal. The verification code itself is
 * never persisted anywhere in plaintext (only a hash — see
 * EmailVerification.codeHash in the schema), so there is no DB shortcut
 * for this; the server's console output is the only place it exists.
 */
export async function latestVerificationCodeForEmail(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = readCodeFromLog(email);
    if (code) return code;
    // The mail "send" happens slightly after the action resolves; give
    // the log a moment to catch up rather than failing on the first miss.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`no verification code found for ${email} after waiting`);
}

export function uniqueTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}
