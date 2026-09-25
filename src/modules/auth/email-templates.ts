import { env } from "@/shared/env";

type VerificationEmailParams = { purpose: "REGISTER"; code: string } | { purpose: "PASSWORD_RESET"; token: string };

export function verificationEmail(params: VerificationEmailParams) {
  if (params.purpose === "REGISTER") {
    const subject = "קוד האימות שלכם ל-SamePath";
    const text = [
      "תודה שנרשמתם ל-SamePath!",
      `קוד האימות שלכם: ${params.code}`,
      "",
      "הקוד תקף ל-15 דקות. אם לא ביקשתם זאת, אפשר להתעלם מהמייל.",
    ].join("\n");

    const html = `
      <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#17211d">
        <h2 style="color:#235c47">SamePath</h2>
        <p>תודה שנרשמתם ל-SamePath! הזינו את הקוד הבא כדי לאמת את כתובת האימייל שלכם:</p>
        <p style="text-align:center">
          <span style="display:inline-block;background:#eff5f1;color:#235c47;padding:16px 32px;border-radius:12px;font-weight:700;font-size:32px;letter-spacing:8px">
            ${params.code}
          </span>
        </p>
        <p style="color:#52615a;font-size:13px">הקוד תקף ל-15 דקות. אם לא ביקשתם זאת, אפשר להתעלם מהמייל.</p>
      </div>
    `;

    return { subject, html, text };
  }

  const subject = "איפוס סיסמה ל-SamePath";
  const intro = "קיבלנו בקשה לאיפוס הסיסמה שלכם ב-SamePath. לבחירת סיסמה חדשה, לחצו על הקישור הבא:";
  const cta = "בחירת סיסמה חדשה";
  const link = `${env.APP_URL}/reset-password?token=${params.token}`;

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
