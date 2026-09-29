import { defineConfig, devices } from "@playwright/test";

// One place, so the server below cannot drift onto a different port than the
// tests are pointed at. PLAYWRIGHT_TEST_BASE_URL is how CI and a
// `next start` on another port override this.
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
const port = Number(new URL(baseURL).port || 3000);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  // Without this, `bun run test:e2e` assumes a server is already up. A fresh
  // clone gets connection-refused, and an E2E suite nobody can run is an E2E
  // suite nobody runs.
  //
  // `dev`, not `start`: `start` needs a prior `bun run build`, which is
  // exactly the manual step this block exists to remove, and the dev server
  // compiles the routes the tests actually visit, so a broken import fails
  // here instead of hiding until CI runs a build. The 120s timeout covers a
  // cold first compile on CI runners.
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    env: { PORT: String(port) },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
