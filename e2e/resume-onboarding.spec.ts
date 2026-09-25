import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readVerificationCode, uniqueTestEmail } from "./helpers/mail";
import { buildMinimalPdf } from "./helpers/pdf-fixture";

/**
 * The resume-upload alternative to manual onboarding (README "Resume
 * upload & extraction"): upload a real PDF, confirm the extracted draft
 * pre-fills the existing profile form correctly, and submit through the
 * same saveProfileStepOne path as manual entry.
 */
test("upload a resume and confirm the pre-filled draft", async ({ page }) => {
  const email = uniqueTestEmail("e2e-resume");
  const companyName = `E2E Resume Co ${Date.now()}`;

  const pdfBuffer = buildMinimalPdf([`${companyName} - Senior Backend Developer`, "03/2022 - Present"]);
  const dir = mkdtempSync(path.join(tmpdir(), "samepath-e2e-"));
  const pdfPath = path.join(dir, "resume.pdf");
  writeFileSync(pdfPath, pdfBuffer);

  await page.goto("/register/create");
  await page.fill("#email", email);
  await page.fill("#password", "e2e-test-password");
  await page.fill("#confirmPassword", "e2e-test-password");
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/verify-email/);
  const code = await readVerificationCode(email);
  await page.fill("#code", code);
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/app\/onboarding\/welcome/);
  await page.getByRole("link", { name: "בואו נתחיל" }).click();
  await page.waitForURL(/\/app\/onboarding\/profile/);

  // Selecting a file uploads it immediately — no separate "upload" click.
  await page.setInputFiles('input[type="file"]', pdfPath);

  // The draft review card (one clickable row per extracted field — not the
  // full manual form) replaces the blank one once extraction finishes.
  await expect(page.getByRole("button", { name: "אישור והמשך" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: `מקום עבודה נוכחי: ${companyName} — עריכה` })).toBeVisible();
  await expect(page.getByRole("button", { name: "תפקיד נוכחי: Senior Backend Developer — עריכה" })).toBeVisible();

  // The seeded "Backend Developer" target role label matches this resume's
  // "Senior Backend Developer" text verbatim, so the deterministic parser
  // pre-selects it — see deterministic-parser.ts's target-role matching.
  await expect(page.getByRole("button", { name: /^תפקיד\/י יעד: .*מפתח\/ת Backend/ })).toBeVisible();

  // Each row opens its own edit dialog; cancelling leaves the card unchanged.
  await page.getByRole("button", { name: /^תפקיד\/י יעד:/ }).click();
  const rolesDialog = page.getByRole("dialog");
  await expect(rolesDialog.getByRole("button", { name: "מפתח/ת Backend" })).toHaveAttribute("aria-pressed", "true");
  await rolesDialog.getByRole("button", { name: "ביטול" }).click();
  await expect(rolesDialog).toBeHidden();

  // The fixture PDF has no LinkedIn URL for the parser to find, so approving
  // opens that field's dialog instead of submitting.
  await page.getByRole("button", { name: "אישור והמשך" }).click();
  const linkedInDialog = page.getByRole("dialog");
  await linkedInDialog.getByLabel("פרופיל LinkedIn").fill("https://www.linkedin.com/in/e2e-test");
  await linkedInDialog.getByRole("button", { name: "שמירה" }).click();
  await expect(linkedInDialog).toBeHidden();

  await page.getByRole("button", { name: "אישור והמשך" }).click();

  // Confirming a resume draft continues onboarding exactly like manual
  // entry does, landing on the privacy step with the extracted employer
  // shown for confirmation.
  await page.waitForURL(/\/app\/onboarding\/privacy/);
  await expect(page.getByText(companyName)).toBeVisible();
});
