import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["dark", "light"] as const) {
  for (const width of [375, 768, 1280, 1920]) {
    test(`${theme} hero at ${width}px: accessible, stable, no overflow`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (theme) => localStorage.setItem("theme", theme),
        theme,
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        // Vercel injects this endpoint only on its hosting platform.
        // Record the pre-existing local-preview issue without hiding hero errors.
        if (
          `${message.location().url} ${message.text()}`.includes(
            "/_vercel/insights/script.js",
          )
        ) {
          testInfo.annotations.push({
            type: "existing-preview-error",
            description: message.text(),
          });
          return;
        }
        if (message.type() === "error" || /hydration/i.test(message.text()))
          errors.push(message.text());
      });
      await page.goto("/");
      const hero = page.locator(".gitvision-hero");
      await expect(hero.getByRole("heading", { level: 1 })).toHaveText(
        "Understand any codebase at the speed of thought",
      );
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await hero.getByRole("img").locator("a, button, [tabindex]").count(),
      ).toBe(0);
      const violations = await new AxeBuilder({ page })
        .include(".gitvision-hero")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(violations.violations).toEqual([]);
      await hero.screenshot({
        path: testInfo.outputPath(`hero-${theme}-${width}.png`),
        animations: "disabled",
      });
      await hero.getByRole("button", { name: "vercel/next.js" }).click();
      const input = hero.getByLabel("Start with a repository");
      await expect(input).toHaveValue("https://github.com/vercel/next.js");
      await expect(input).toBeFocused();
      expect(
        await input.evaluate(
          (element) => getComputedStyle(element).outlineWidth,
        ),
      ).toBe("0px");
      expect(
        await hero
          .locator(".hero-search")
          .evaluate((element) => getComputedStyle(element).boxShadow),
      ).not.toBe("none");
      for (const control of await hero.locator("a, button, input").all()) {
        const bounds = await control.boundingBox();
        if (bounds) expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("keyboard shortcut, validation, and CTA destinations", async ({
  page,
}) => {
  await page.goto("/");
  const hero = page.locator(".gitvision-hero");
  const input = hero.getByLabel("Start with a repository");
  await page.keyboard.press("/");
  await expect(input).toBeFocused();
  await input.fill("https://gitlab.com/owner/repo");
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(
    hero.getByText("Enter a GitHub repository URL or owner/repo."),
  ).toBeVisible();
  await expect(
    hero.getByRole("link", { name: "Get started for free" }),
  ).toHaveAttribute("href", "/sign-up");
  await expect(
    hero.getByRole("link", { name: "See how it works" }),
  ).toHaveAttribute("href", "#features");
  await expect(
    hero.getByRole("link", { name: /GitVision 2.0/ }),
  ).toHaveAttribute("href", "#features");
});

test("demo runs, pauses at its completed state and resumes", async ({
  page,
}) => {
  await page.goto("/");
  const workbench = page.getByTestId("hero-workbench");
  await workbench.scrollIntoViewIfNeeded();
  const hiddenWords = page.locator(
    '[data-testid="hero-demo-answer"] span[style*="opacity: 0"]',
  );
  await expect.poll(() => hiddenWords.count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause demo" }).click();
  await expect(hiddenWords).toHaveCount(0);
  await expect(page.getByTestId("hero-selected-file")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await page.getByRole("button", { name: "Resume demo" }).click();
  await expect.poll(() => hiddenWords.count()).toBeGreaterThan(0);
  await expect(page.getByTestId("hero-selected-file")).toHaveAttribute(
    "data-selected",
    "true",
    { timeout: 10000 },
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(hiddenWords).toHaveCount(0);
});

test("reduced motion keeps the completed workbench stationary", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const workbench = page.getByTestId("hero-workbench");
  await workbench.scrollIntoViewIfNeeded();
  await workbench.hover();
  await expect(workbench).toHaveCSS("transform", "none");
  await expect(
    page.getByRole("button", { name: "Static preview" }),
  ).toBeDisabled();
  await expect(page.getByTestId("hero-selected-file")).toHaveAttribute(
    "data-selected",
    "true",
  );
});

test("headline and complete example are visible without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:3000");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByTestId("hero-workbench")).toBeVisible();
  await context.close();
});

test("fine-pointer tilt is bounded and returns to rest", async ({ page }) => {
  await page.goto("/");
  const workbench = page.getByTestId("hero-workbench");
  await workbench.scrollIntoViewIfNeeded();
  const bounds = await workbench.boundingBox();
  expect(bounds).not.toBeNull();
  await workbench.hover({ position: { x: 50, y: 120 } });
  await expect
    .poll(() => workbench.evaluate((element) => element.style.transform))
    .toMatch(/rotateX/);
  const transform = await workbench.evaluate(
    (element) => element.style.transform,
  );
  for (const rotation of transform.matchAll(/rotate[XY]\(([-\d.]+)deg\)/g))
    expect(Math.abs(Number(rotation[1]))).toBeLessThanOrEqual(6);
  await page.mouse.move(0, 0);
  await expect
    .poll(() => workbench.evaluate((element) => element.style.transform))
    .not.toMatch(/rotate[XY]/);
});

test("touch devices use static perspective and usable inputs", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 1000 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("http://localhost:3000");
  await page.getByRole("button", { name: "facebook/react" }).tap();
  await expect(page.getByLabel("Start with a repository")).toHaveValue(
    "https://github.com/facebook/react",
  );
  await expect(page.getByTestId("hero-workbench")).toHaveCSS(
    "transform",
    "none",
  );
  await context.close();
});

test("changing reduced-motion preference stops an active demo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("hero-workbench").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Pause demo" })).toBeEnabled();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Static preview" }),
  ).toBeDisabled();
  await expect(page.getByTestId("hero-selected-file")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.getByTestId("hero-workbench")).toHaveCSS(
    "transform",
    "none",
  );
});
