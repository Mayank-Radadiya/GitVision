import { expect, test } from "@playwright/test";

/**
 * T-033 — proof that the auth state written by `e2e/global-setup.ts` is real.
 *
 * Both tests assert on the *redirect* rather than deep page contents, because
 * `proxy.ts` calls `auth.protect()` on every non-public route: a signed-out
 * visitor asking for `/dashboard` is answered with a redirect to `/sign-in`.
 * That is the observable difference between the two states, and it is the one
 * assertion that cannot pass for the wrong reason.
 */
test.describe("authenticated", () => {
  test("a protected route renders for a signed-in user", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Add Repository/i }),
    ).toBeVisible();
  });
});

test.describe("signed out", () => {
  // Negative control. A fresh, empty storage state is what every request
  // looks like without a session — if the authenticated test above ever
  // passes for the wrong reason, this one is what catches it.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a protected route redirects to sign-in", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/sign-in/);
  });
});
