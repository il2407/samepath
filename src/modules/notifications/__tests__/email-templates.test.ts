import { describe, expect, it } from "vitest";
import { accountApprovedEmail, contributionDecisionEmail } from "@/modules/notifications/email-templates";

describe("accountApprovedEmail", () => {
  it("links back into the app", () => {
    const email = accountApprovedEmail();
    expect(email.subject).toBeTruthy();
    expect(email.html).toContain("/app");
    expect(email.text).toContain("/app");
  });
});

describe("contributionDecisionEmail", () => {
  it("produces a distinct subject per decision", () => {
    const subjects = (["APPROVED", "REJECTED", "NEEDS_CHANGES"] as const).map(
      (decision) => contributionDecisionEmail({ decision, companyName: "Acme" }).subject,
    );
    expect(new Set(subjects).size).toBe(3);
  });

  it("escapes the moderator note and company name in the HTML body", () => {
    const email = contributionDecisionEmail({
      decision: "REJECTED",
      companyName: "<b>Acme</b>",
      message: '<script>alert("x")</script>',
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Acme</b>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.text).toContain('<script>alert("x")</script>');
  });
});
