import { env } from "@/shared/env";

type EmailPurpose = "REGISTER" | "PASSWORD_RESET";

const copy: Record<EmailPurpose, { subject: string; intro: string; cta: string; path: string }> = {
  REGISTER: {
    subject: "אימות כתובת האימייל שלכם ב-SamePath",
    intro: "תודה שנרשמתם ל-SamePath! כדי לאמת את כתובת האימייל שלכם, לחצו על הקישור הבא:",
    cta: "אימות כתובת האימייל",
    path: "/api/auth/verify",
  },
  PASSWORD_RESET: {
    subject: "איפוס סיסמה ל-SamePath",
    intro: "קיבלנו בקשה לאיפוס הסיסמה שלכם ב-SamePath. לבחירת סיסמה חדשה, לחצו על הקישור הבא:",
    cta: "בחירת סיסמה חדשה",
    path: "/reset-password",
  },
};

export function verificationEmail(params: { token: string; purpose: EmailPurpose }) {
  const { subject, intro, cta, path } = copy[params.purpose];
  const link = `${env.APP_URL}${path}?token=${params.token}`;

  const text = [intro, "", link, "", "הקישור תקף ל-15 דקות. אם לא ביקשתם זאת, אפשר להתעלם מהמייל."].join("\n");

  const html = `
    <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#17211d">
      <h2 style="color:#235c47">SamePath</h2>
      <p>${intro}</p>
      <p style="text-align:center">
        <a href="${link}" style="display:inline-block;background:#235c47;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
          ${cta}
        </a>
      </p>
      <p style="color:#52615a;font-size:13px">הקישור תקף ל-15 דקות. אם לא ביקשתם זאת, אפשר להתעלם מהמייל.</p>
    </div>
  `;

  return { subject, html, text };
}
