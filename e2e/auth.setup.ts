import { test as setup, expect } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * T-033 — authenticated E2E harness.
 *
 * Before this existed, `e2e/` held exactly one spec (`smoke.spec.ts`) that
 * visits `/` and asserts a title. `/` is the only route on `proxy.ts`'s public
 * allowlist that renders the product, so that spec passed while the entire
 * signed-in product was untestable — and worse, it passed *because* it could
 * not reach anything protected. `auth.protect()` answers every other route
 * with a redirect to `/sign-in`, so a spec pointed at `/dashboard` would have
 * been bounced and the only reason to notice is an assertion that fails for
 * the right reason. Every one of T-033's downstream tasks (T-034, T-035,
 * T-036, T-087) was blocked on that.
 *
 * This is a Playwright *setup project*. It runs once, authenticates a fixture
 * user, and writes a `storageState` file that `playwright.config.ts` points
 * the `chromium` project at via `dependencies: ["setup"]`. So
 * `bun run test:e2e` cannot reach an authenticated spec without this having
 * succeeded first.
 *
 * ## Credentials
 *
 * `clerkSetup` reads `CLERK_SECRET_KEY` and the publishable key from the
 * environment, exchanges them for a short-lived testing token, and refuses a
 * *production* secret key outright — which is the behaviour we want, because a
 * test run must never mint a session against a live instance. `.env.example`
 * documents the three names.
 *
 * There is deliberately no anonymous fallback. If this file cannot
 * authenticate, the run must report that it could not test the signed-in
 * product rather than quietly execute every spec signed out — which is
 * precisely the failure mode T-033 exists to close, and precisely the one
 * `smoke.spec.ts`'s green tick was hiding.
 */

const AUTH_STATE_PATH = ".auth/user.json";

function credentialHelp(name: string, hint: string): Error {
  return new Error(
    [
      `T-033: cannot authenticate — ${name} is not set.`,
      `  ${hint}`,
      ``,
      `  There is no anonymous fallback on purpose. Running the signed-in specs`,
      `  without a session would assert nothing about the signed-in product,`,
      `  which is the defect this task exists to close. Fix the credential or`,
      `  the environment; do not make this file skip.`,
    ].join("\n"),
  );
}

setup("authenticate a Clerk fixture user", async ({ page }) => {
  const publishableKey =
    process.env.CLERK_TESTING_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!process.env.CLERK_SECRET_KEY) {
    throw credentialHelp(
      "CLERK_SECRET_KEY",
      "Clerk dashboard → API Keys → Secret key (a test/dev instance; a production key is rejected by clerkSetup)."
    );
  }
  if (!publishableKey) {
    throw credentialHelp(
      "CLERK_TESTING_PUBLISHABLE_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "Clerk dashboard → API Keys → Publishable key. It is also what the frontend API URL is parsed from."
    );
  }

  // Exchanges the key pair for a token and installs the route handler that
  // attaches it to every Frontend API call, so the app boots already signed
  // in rather than rendering a sign-in screen we then have to click through.
  await clerkSetup({ publishableKey });
  await setupClerkTestingToken({ page });

  await page.goto("/");
  await page.context().storageState({ path: AUTH_STATE_PATH });

  // A token that never landed is worse than no token: every downstream spec
  // would load and then assert against /sign-in. Prove Clerk actually holds a
  // session before writing the state out.
  const signedIn = await page.evaluate(() =>
    Object.keys(window.localStorage).some((k) => k.toLowerCase().includes("clerk"))
  );
  expect(
    signedIn,
    "Clerk wrote no session to localStorage — the testing token was not accepted."
  ).toBe(true);
});
