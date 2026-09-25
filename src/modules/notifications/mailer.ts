import { env } from "@/shared/env";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Logs the email to the server console instead of sending it. Default for
 * local development — no external account or network access required.
 */
class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.log(
      [
        "",
        "── ✉️  MAIL (console adapter) ─────────────────────────────",
        `to:      ${message.to}`,
        `subject: ${message.subject}`,
        "",
        message.text,
        "────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
}

/**
 * Sends real mail over SMTP. Works with any provider that speaks SMTP
 * (configured entirely through environment variables), so swapping
 * providers never touches application code.
 */
class SmtpMailer implements Mailer {
  private transportPromise: Promise<import("nodemailer").Transporter> | null = null;

  private async transport() {
    if (!this.transportPromise) {
      this.transportPromise = import("nodemailer").then((nodemailer) =>
        nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          // Port 465 is implicit TLS; every other port must upgrade via
          // STARTTLS rather than silently falling back to plaintext.
          requireTLS: env.SMTP_PORT !== 465,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
        }),
      );
      // A connection failure shouldn't poison every future send for the
      // life of the process — let the next call retry a fresh transport.
      this.transportPromise.catch(() => {
        this.transportPromise = null;
      });
    }
    return this.transportPromise;
  }

  async send(message: MailMessage): Promise<void> {
    const transport = await this.transport();
    try {
      await transport.sendMail({
        from: env.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (error) {
      console.error(`SmtpMailer: failed to send mail to ${message.to}:`, error);
      throw error;
    }
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (!mailer) {
    mailer = env.MAIL_ADAPTER === "smtp" ? new SmtpMailer() : new ConsoleMailer();
  }
  return mailer;
}
