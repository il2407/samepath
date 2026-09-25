import { env } from "@/shared/env";

// Transactional emails that pair with an in-app notification. Pure string
// builders (no DB, no mailer) so they stay trivially unit-testable; callers
// send them via getMailer().

type Email = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(paragraphs: string[], cta: { label: string; path: string }): string {
  const link = `${env.APP_URL}${cta.path}`;
  return `
    <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#17211d">
      <h2 style="color:#235c47">SamePath</h2>
      ${paragraphs.map((p) => `<p>${p}</p>`).join("\n      ")}
      <p style="text-align:center">
        <a href="${link}" style="display:inline-block;background:#235c47;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
          ${cta.label}
        </a>
      </p>
    </div>
  `;
}

export function accountApprovedEmail(): Email {
  const subject = "החשבון שלכם ב-SamePath אושר";
  const lines = [
    "החשבון שלכם ב-SamePath אושר על ידי הצוות.",
    "מעכשיו המערכת תתחיל להציע לכם התאמות לאנשים שנמצאים באותה דרך מקצועית.",
  ];
  const cta = { label: "מעבר ל-SamePath", path: "/app" };
  return {
    subject,
    text: [...lines, "", `${env.APP_URL}${cta.path}`].join("\n"),
    html: layout(lines, cta),
  };
}

export type ContributionDecision = "APPROVED" | "REJECTED" | "NEEDS_CHANGES";

export function contributionDecisionEmail(params: {
  decision: ContributionDecision;
  companyName: string;
  message?: string | null;
}): Email {
  const company = params.companyName;
  const cta = { label: "לתרומות שלי", path: "/app/contributions" };

  const byDecision: Record<ContributionDecision, { subject: string; line: string }> = {
    APPROVED: {
      subject: "שאלות הראיון ששיתפתם אושרו",
      line: `שאלות הראיון ששיתפתם על ${company} אושרו על ידי הצוות ויתפרסמו בספרייה. תודה על התרומה!`,
    },
    REJECTED: {
      subject: "שאלות הראיון ששיתפתם לא אושרו",
      line: `לאחר בדיקה, שאלות הראיון ששיתפתם על ${company} לא אושרו לפרסום.`,
    },
    NEEDS_CHANGES: {
      subject: "הצוות ביקש שינויים בשאלות הראיון ששיתפתם",
      line: `הצוות ביקש כמה שינויים בשאלות הראיון ששיתפתם על ${company} לפני שיוכלו להתפרסם.`,
    },
  };
  const { subject, line } = byDecision[params.decision];
  const note = params.message?.trim();

  const textLines = [line, ...(note ? ["", `הערת הצוות: ${note}`] : [])];
  const htmlLines = [
    escapeHtml(line),
    ...(note ? [`<strong>הערת הצוות:</strong> ${escapeHtml(note)}`] : []),
  ];

  return {
    subject,
    text: [...textLines, "", `${env.APP_URL}${cta.path}`].join("\n"),
    html: layout(htmlLines, cta),
  };
}
