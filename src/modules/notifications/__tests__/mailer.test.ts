import { beforeEach, describe, expect, it, vi } from "vitest";

const env: {
  MAIL_ADAPTER: "console" | "smtp";
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  MAIL_FROM: string;
} = {
  MAIL_ADAPTER: "smtp",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: 587,
  SMTP_USER: "user@example.com",
  SMTP_PASSWORD: "hunter2",
  MAIL_FROM: "SamePath <no-reply@samepath.local>",
};

vi.mock("@/shared/env", () => ({ env }));

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock("nodemailer", () => ({ createTransport }));

// mailer.ts caches its Mailer singleton at module scope, so each test needs
// a fresh module instance to get a fresh SmtpMailer.
async function loadMailer() {
  vi.resetModules();
  return import("../mailer");
}

describe("SmtpMailer", () => {
  beforeEach(() => {
    createTransport.mockClear();
    sendMail.mockClear();
    sendMail.mockResolvedValue(undefined);
    env.MAIL_ADAPTER = "smtp";
    env.SMTP_HOST = "smtp.example.com";
    env.SMTP_PORT = 587;
    env.SMTP_USER = "user@example.com";
    env.SMTP_PASSWORD = "hunter2";
  });

  it("builds a transport that requires TLS on the STARTTLS port (587)", async () => {
    const { getMailer } = await loadMailer();
    await getMailer().send({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: "user@example.com", pass: "hunter2" },
      }),
    );
  });

  it("uses implicit TLS (secure, no requireTLS) on port 465", async () => {
    env.SMTP_PORT = 465;
    const { getMailer } = await loadMailer();
    await getMailer().send({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true, requireTLS: false }),
    );
  });

  it("omits auth when no SMTP user is configured", async () => {
    env.SMTP_USER = "";
    const { getMailer } = await loadMailer();
    await getMailer().send({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
  });

  it("sends mail through the transport with the configured from address", async () => {
    const { getMailer } = await loadMailer();
    await getMailer().send({ to: "a@b.com", subject: "hi", html: "<p>hi</p>", text: "hi" });

    expect(sendMail).toHaveBeenCalledWith({
      from: "SamePath <no-reply@samepath.local>",
      to: "a@b.com",
      subject: "hi",
      html: "<p>hi</p>",
      text: "hi",
    });
  });

  it("reuses the same transport across multiple sends", async () => {
    const { getMailer } = await loadMailer();
    const mailer = getMailer();
    await mailer.send({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" });
    await mailer.send({ to: "c@d.com", subject: "s", html: "<p>h</p>", text: "t" });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("propagates a sendMail failure instead of swallowing it", async () => {
    sendMail.mockRejectedValueOnce(new Error("connection refused"));
    const { getMailer } = await loadMailer();

    await expect(
      getMailer().send({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" }),
    ).rejects.toThrow("connection refused");
  });

  it("builds a fresh transport after a prior transport creation failed", async () => {
    createTransport.mockImplementationOnce(() => {
      throw new Error("DNS lookup failed");
    });
    const { getMailer } = await loadMailer();
    const mailer = getMailer();

    await expect(
      mailer.send({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" }),
    ).rejects.toThrow("DNS lookup failed");

    // A later call must retry transport creation rather than staying stuck
    // on the same rejected promise for the rest of the process lifetime.
    await mailer.send({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "t" });
    expect(createTransport).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
