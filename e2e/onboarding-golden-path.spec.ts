import { test, expect } from "@playwright/test";
import { uniqueTestEmail } from "./helpers/mail";

/**
 * The single most important path in the app: a brand-new visitor can
 * register, complete manual profile onboarding (the non-resume path — see
 * resume-onboarding.spec.ts for the upload/extraction path), confirm their
 * employer and privacy preferences, set connection preferences, and land
 * on the real authenticated app shell. If this breaks, nothing else about
 * SamePath matters.
 */
test("register, complete manual onboarding, and land on the app", async ({ page }) => {
  const email = uniqueTestEmail("e2e-onboarding");
  const companyName = `E2E Test Co ${Date.now()}`;

  await page.goto("/register");
  await page.fill("#email", email);
  await page.fill("#password", "e2e-test-password");
  await page.fill("#confirmPassword", "e2e-test-password");
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/app\/onboarding\/profile/);

  // --- Step 1: profile ---
  const roleChip = page.getByText("תפקיד/י יעד", { exact: false }).locator("..").getByRole("button").first();
  await roleChip.click();

  await page.fill("#currentRoleTitle", "מהנדס/ת Backend");

  const companyInput = page.getByPlaceholder("שם החברה הנוכחית");
  await companyInput.fill(companyName);
  await page.getByRole("button", { name: `החברה לא ברשימה — הוספת "${companyName}"` }).click();
  await expect(companyInput).toHaveValue(companyName);

  await page.fill('input[aria-label="תאריך תחילת העבודה"]', "2022-01");

  const languageChip = page.getByText("שפות", { exact: true }).locator("..").getByRole("button").first();
  await languageChip.click();

  await page.getByRole("button", { name: "המשך להגדרות פרטיות" }).click();

  // --- Step 2: privacy ---
  await page.waitForURL(/\/app\/onboarding\/privacy/);
  await expect(page.getByText(companyName)).toBeVisible();

  await page.getByRole("checkbox", { name: "כן, זהו המעסיק הנוכחי שלי" }).check();
  await page.getByPlaceholder('לדוגמה: "מ." או "מפתחת Backend"').fill("E.");

  await page.getByRole("button", { name: "המשך להעדפות חיבור" }).click();

  // --- Step 3: connection preferences ---
  await page.waitForURL(/\/app\/onboarding\/preferences/);
  await page.getByRole("button", { name: "הפעלת הפרופיל" }).click();

  // --- Landed on the real app ---
  await page.waitForURL(/\/app$/);
  await expect(page).toHaveURL(/\/app$/);
});
