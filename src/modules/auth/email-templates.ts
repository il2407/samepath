import { env } from "@/shared/env";

export function verificationEmail(params: { code: string; token: string; purpose: "REGISTER" | "LOGIN" }) {
  const link = `${env.APP_URL}/api/auth/verify?token=${params.token}`;
  const intro =
    params.purpose === "REGISTER"
      ? "כדי להשלים את ההרשמה ל-SamePath, הזינו את הקוד הבא:"
      : "כדי להתחבר ל-SamePath, הזינו את הקוד הבא:";

  const text = [
    intro,
    "",
    params.code,
    "",
    `או לחצו על הקישור הזה: ${link}`,
    "",
    "הקוד תקף ל-15 דקות. אם לא ביקשתם קוד זה, אפשר להתעלם מהמייל.",
  ].join("\n");

  const html = `
    <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#17201e">
      <h2 style="color:#0f695a">SamePath</h2>
      <p>${intro}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:4px;background:#e5f4ef;padding:16px 24px;border-radius:12px;text-align:center">
        ${params.code}
      </p>
      <p>או <a href="${link}" style="color:#0f695a">לחצו כאן להמשך</a>.</p>
      <p style="color:#65706d;font-size:13px">הקוד תקף ל-15 דקות. אם לא ביקשתם קוד זה, אפשר להתעלם מהמייל.</p>
    </div>
  `;

  return {
    subject: params.purpose === "REGISTER" ? "קוד ההרשמה שלכם ל-SamePath" : "קוד ההתחברות שלכם ל-SamePath",
    html,
    text,
  };
}
