import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright boots nothing by itself. Without the `webServer` block below, this
 * suite assumed something was already listening on 3000, so a fresh clone ran
 * `bun run test:e2e`, got ERR_CONNECTION_REFUSED, and had no way to tell that
 * apart from a real regression — which is how an E2E suite quietly stops being
 * run at all.
 */
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";

/**
 * `bun run dev`, not `bun run start`. `start` needs a prior `bun run build`,
 * which makes the suite a two-command affair and lets a stale build answer the
 * tests; `dev` boots slower but is self-contained from a cold clone and sees
 * the source under test rather than whatever was compiled last.
 *
 * The env override exists only for the no-`.env` case (a fresh clone, CI).
 * `next dev` loads `.env` itself, and Next does not overwrite variables that
 * are already set — so passing a placeholder unconditionally would shadow the
 * developer's real token with a fake one. With a `.env` present we pass nothing
 * and let Next use it. `github/client.ts` throwing at module load when
 * `GITHUB_TOKEN` is unset is why a placeholder is needed at all; T-010 moves
 * that check to first use, after which this whole block can go.
 */
const bootEnv: Record<string, string> =
  existsSync(".env") || existsSync(".env.local")
    ? {}
    : { GITHUB_TOKEN: "e2e-placeholder-not-a-real-token" };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  webServer: {
    command: "bun run dev",
    url: baseURL,
    // Locally, keep a dev server the developer already has open. In CI there is
    // never one, and reusing it would only mask a port clash.
    reuseExistingServer: !process.env.CI,
    // A cold `next dev --turbopack` first-run compile is slow; the 30s default
    // expires before the first page exists.
    timeout: 120_000,
    env: bootEnv,
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
