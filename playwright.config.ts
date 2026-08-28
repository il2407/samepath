import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against the local dev database (`.env`, already migrated and
 * seeded — see README "Local development setup"), not the vitest
 * integration suite's throwaway `.env.test` database: e2e specs need the
 * seeded reference data (fields, roles, tags, languages, an admin
 * account) to exercise real forms, and vitest's per-test TRUNCATE reset
 * would make that data disappear out from under a long-running browser
 * session. Each spec creates its own throwaway users with a
 * timestamped email so runs don't collide with each other or with the
 * seeded fictional accounts.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev > ${process.env.E2E_SERVER_LOG ?? "/tmp/samepath-e2e-server.log"} 2>&1`,
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
