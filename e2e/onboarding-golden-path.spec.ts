import { test, expect } from "@playwright/test";
import { readVerificationCode, uniqueTestEmail } from "./helpers/mail";

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
  await page.waitForURL(/\/register\/create/);
  await page.fill("#email", email);
  await page.fill("#password", "e2e-test-password");
  await page.fill("#confirmPassword", "e2e-test-password");
  await page.click('button[type="submit"]');

  // Registration always gates on a 6-digit email OTP (auth/actions.ts,
  // registerWithPasswordAction) — no dev/test bypass exists, so read the
  // code the console mailer just wrote to the dev server's own log.
  await page.waitForURL(/\/verify-email/);
  const code = await readVerificationCode(email);
  await page.fill("#code", code);
  await page.click('button[type="submit"]');

  // The steps explanation comes first, right after the OTP.
  await page.waitForURL(/\/app\/onboarding\/welcome/);
  await page.getByRole("link", { name: "בואו נתחיל" }).click();
  await page.waitForURL(/\/app\/onboarding\/profile/);

  // --- Step 1: profile ---
  // The profile step opens on an upload-or-manual choice screen
  // (ManualEntryToggle.tsx) — the manual form is hidden until this button
  // reveals it, so this test (the non-resume path) must click through it
  // first; see resume-onboarding.spec.ts for the upload path.
  await page.getByRole("button", { name: "מילוי ידני במקום" }).click();

  const roleChip = page.getByText("תפקיד/י יעד", { exact: false }).locator("..").getByRole("button").first();
  await roleChip.click();

  await page.fill("#currentRoleTitle", "מהנדס/ת Backend");

  const companyInput = page.getByPlaceholder("שם החברה הנוכחית");
  await companyInput.fill(companyName);
  await page.getByRole("button", { name: `החברה לא ברשימה — הוספת "${companyName}"` }).click();
  await expect(companyInput).toHaveValue(companyName);

  await page.fill('input[aria-label="תאריך תחילת העבודה"]', "2022-01");

  await page.fill("#linkedInUrl", "https://www.linkedin.com/in/e2e-test");

  await page.getByRole("button", { name: "המשך להגדרות פרטיות" }).click();

  // --- Step 2: privacy ---
  await page.waitForURL(/\/app\/onboarding\/privacy/);
  await expect(page.getByText(companyName)).toBeVisible();

  // Back-navigation regression check: the "back to edit profile" link used
  // to be a dead end — saveProfileStepOne moves ProfessionalProfile.status
  // off DRAFT the moment step 1 is first saved, so the profile page's own
  // forward guard would immediately redirect straight back here (see
  // AGENTS.md / the WS1 backlog item on this). Clicking it must land back
  // on step 1 with previously-entered values pre-filled, not loop back to
  // this page.
  await page.getByRole("link", { name: "חזרה לעריכת הפרופיל המקצועי" }).click();
  await page.waitForURL(/\/app\/onboarding\/profile\?edit=true/);
  await expect(page.locator("#currentRoleTitle")).toHaveValue("מהנדס/ת Backend");
  await expect(page.getByPlaceholder("שם החברה הנוכחית")).toHaveValue(companyName);

  // Continuing forward again from the re-edit must not lose or duplicate
  // data, and must not silently re-trigger unrelated side effects.
  await page.getByRole("button", { name: "שמירה והמשך" }).click();
  await page.waitForURL(/\/app\/onboarding\/privacy/);
  await expect(page.getByText(companyName)).toBeVisible();

  // The current employer is now auto-detected and always blocked
  // (PrivacyStepForm.tsx) — there's no separate confirmation checkbox to
  // check anymore, so the flow goes straight to the next step.
  await page.getByRole("button", { name: "המשך להעדפות חיבור" }).click();

  // --- Step 3: connection preferences ---
  await page.waitForURL(/\/app\/onboarding\/preferences/);
  await page.getByRole("button", { name: "המשך לסקירה" }).click();

  // --- Step 4: review before final activation ---
  // A review/summary step (overview/page.tsx) was inserted between
  // connection preferences and activation — it recaps every prior step and
  // only then exposes the real "activate profile" control.
  await page.waitForURL(/\/app\/onboarding\/overview/);
  // The company name legitimately appears twice here (the "professional
  // profile" recap and the "current employer" privacy recap), so this needs
  // .first() to avoid a strict-mode violation.
  await expect(page.getByText(companyName).first()).toBeVisible();
  await page.getByRole("button", { name: "אישור והפעלת הפרופיל" }).click();

  // --- Landed on the real app ---
  // Activation now redirects with a welcome query string
  // (?welcome=1&matches=N), not a bare /app.
  await page.waitForURL(/\/app(\?|$)/);
  await expect(page).toHaveURL(/\/app(\?|$)/);
});
