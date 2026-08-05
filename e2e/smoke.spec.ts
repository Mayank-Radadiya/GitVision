import { test, expect } from "@playwright/test";

test.describe("Smoke Test", () => {
  test("home page loads and has title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/GitVision|Git Vision/i);
  });
});
