import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { uniqueTestEmail } from "./helpers/mail";
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

  await page.goto("/register");
  await page.fill("#email", email);
  await page.fill("#password", "e2e-test-password");
  await page.fill("#confirmPassword", "e2e-test-password");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app\/onboarding\/profile/);

  // Selecting a file uploads it immediately — no separate "upload" click.
  await page.setInputFiles('input[type="file"]', pdfPath);

  // The draft review form replaces the blank one once extraction finishes.
  await expect(page.getByRole("button", { name: "אישור ושמירת הפרופיל" })).toBeVisible({ timeout: 15_000 });
  // The extracted company name lands as the CompanyPicker input's value,
  // not as standalone page text.
  await expect(page.getByPlaceholder("שם החברה הנוכחית")).toHaveValue(companyName);
  await expect(page.locator("#currentRoleTitle")).toHaveValue("Senior Backend Developer");

  // The seeded "Backend Developer" target role label matches this resume's
  // "Senior Backend Developer" text verbatim, so the deterministic parser
  // now pre-selects it (and the professional field chips filter to match) —
  // see deterministic-parser.ts's target-role matching. Assert that instead
  // of blindly clicking the first chip, which would otherwise toggle an
  // already-selected role back off.
  const backendRoleChip = page.getByRole("button", { name: "מפתח/ת Backend" });
  await expect(backendRoleChip).toHaveAttribute("aria-pressed", "true");

  const roleChip = page.getByText("תפקיד/י יעד", { exact: false }).locator("..").getByRole("button").first();
  if ((await roleChip.getAttribute("aria-pressed")) !== "true") {
    await roleChip.click();
  }
  const languageChip = page.getByText("שפות", { exact: true }).locator("..").getByRole("button").first();
  if ((await languageChip.getAttribute("aria-pressed")) !== "true") {
    await languageChip.click();
  }

  await page.getByRole("button", { name: "אישור ושמירת הפרופיל" }).click();

  // Confirming a resume draft continues onboarding exactly like manual
  // entry does, landing on the privacy step with the extracted employer
  // shown for confirmation.
  await page.waitForURL(/\/app\/onboarding\/privacy/);
  await expect(page.getByText(companyName)).toBeVisible();
});
