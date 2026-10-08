import { defineConfig, devices } from "@playwright/test";

// Public hero checks run without the authenticated suite's account setup.
// Run `bun run build` first; an existing production preview is reused.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "hero.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3000",
    // Optional local Chromium installation; CI uses Playwright's browser.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
    storageState: { cookies: [], origins: [] },
  },
  webServer: {
    command: "bun run start -- --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
