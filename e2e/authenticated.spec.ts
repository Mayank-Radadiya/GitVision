import { test, expect } from "@playwright/test";

/**
 * T-033 — proof the harness actually authenticates.
 *
 * This spec is deliberately about the *session*, not about features. If it
 * fails, every other signed-in spec is suspect; if it passes, a red elsewhere
 * means a real defect rather than a harness artefact. That is why it asserts
 * on the redirect rather than on a page's contents: `proxy.ts` calls
 * `auth.protect()` on every non-public route, so being *not* on `/sign-in`
 * after requesting `/dashboard` is the observable difference between an
 * authenticated and an anonymous browser.
 */
test.describe("T-033 — authenticated session", () => {
  test("a protected route does not bounce to sign-in", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(
      page.getByRole("navigation").first()
    ).toBeVisible();
  });

  test("the project list shell renders for a signed-in user", async ({ page }) => {
    await page.goto("/dashboard");

    // `/` and `/legal/*` are public; everything else sits behind
    // `auth.protect()`. Landing on the real dashboard body — rather than a
    // sign-in form wearing the same layout — is what distinguishes the two.
    await expect(page.locator("main")).toBeVisible();
    await expect(page).not.toHaveURL(/\/sign-in/);
  });
});
