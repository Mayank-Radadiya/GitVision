/**
 * T-087 — automated accessibility gate.
 *
 * Runs axe-core over the public and authenticated surfaces, failing on any
 * critical or serious WCAG 2.1 A/AA violation. Findings are reported with the
 * rule id, the axe help text, the remediation URL, and the CSS selector of
 * every offending node, so a failure is actionable from the Playwright output
 * alone without opening the HTML report.
 *
 * task.md lists /chat/[id] and /code-viewer/[id], but those ids require seeded
 * database rows that the T-033 harness does not create. This suite therefore
 * audits the /chat and /code-viewer list routes, which render the same shell
 * and page chrome without fixtures.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Types are derived from the builder rather than imported from "axe-core",
// which is only a transitive dependency (via eslint-plugin-jsx-a11y) and must
// not be treated as a direct one.
type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type AxeViolation = AxeResults["violations"][number];

function formatViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) {
    return "No critical or serious WCAG 2.1 A/AA violations found.";
  }

  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact})\n` +
        `  ${violation.help}\n` +
        `  ${violation.helpUrl}\n` +
        `  affected: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
    )
    .join("\n\n");
}

async function expectNoBlockingViolations(page: Page, readySelector: string) {
  // Wait for the page's own ready signal so axe audits the rendered page and
  // not a loading skeleton.
  await page.locator(readySelector).first().waitFor({ state: "visible" });

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  // `impact` is optional on the axe result type, so compare explicitly instead
  // of relying on truthiness.
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking, formatViolations(blocking)).toEqual([]);
}

const PUBLIC_ROUTES = [
  { name: "landing", path: "/", ready: "main" },
  { name: "sign-in", path: "/sign-in", ready: "form" },
] as const;

const AUTHENTICATED_ROUTES = [
  { name: "dashboard", path: "/dashboard", ready: "main" },
  { name: "chat", path: "/chat", ready: "h1" },
  { name: "code viewer", path: "/code-viewer", ready: "h1" },
] as const;

test.describe("accessibility (signed out)", () => {
  // Negative control: (auth)/layout.tsx redirects to /dashboard once Clerk
  // reports a signed-in user, so public routes must be scanned with no session.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) has no critical or serious WCAG 2.1 A/AA violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(`${route.path.replace("/", "\\/")}$`));
      await expectNoBlockingViolations(page, route.ready);
    });
  }
});

test.describe("accessibility (authenticated)", () => {
  // Inherits storageState: "e2e/.auth/user.json" from playwright.config.ts.
  for (const route of AUTHENTICATED_ROUTES) {
    test(`${route.name} (${route.path}) has no critical or serious WCAG 2.1 A/AA violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(`${route.path.replace("/", "\\/")}$`));
      await expectNoBlockingViolations(page, route.ready);
    });
  }
});
