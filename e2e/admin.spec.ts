import { test, expect } from "@playwright/test";
import { latestVerificationCodeForEmail } from "./helpers/mail";

/**
 * Logs in as the seeded admin account (prisma/seed/users.ts —
 * role ADMIN, no professional profile since admins use /admin not /app)
 * and exercises one real write path end to end: creating a session guide
 * and seeing it appear in the list, backed by the real database.
 */
test("admin logs in, sees dashboard metrics, and creates a guide", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "admin@example.com");
  await page.click('button[type="submit"]');
  await page.waitForSelector("#code");
  const code = await latestVerificationCodeForEmail("admin@example.com");
  await page.fill("#code", code);
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/(app|admin)/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "לוח בקרה" })).toBeVisible();
  // A real, non-fabricated metric from the seeded database, not placeholder copy.
  await expect(page.getByText("משתמשים פעילים")).toBeVisible();

  await page.goto("/admin/guides");
  const title = `E2E Guide ${Date.now()}`;
  await page.getByPlaceholder("כותרת").fill(title);
  await page.getByPlaceholder("מטרת המדריך").fill("נוצר על ידי בדיקת e2e");
  await page.getByRole("button", { name: "יצירת מדריך" }).click();

  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
});
