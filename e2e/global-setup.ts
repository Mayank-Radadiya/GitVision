import { chromium, expect, type FullConfig } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

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
 * This is the Playwright `globalSetup` hook. It runs once per `test:e2e`,
 * authenticates a fixture user, and writes a `storageState` file that
 * `playwright.config.ts` points the `chromium` project at, so no signed-in
 * spec can execute without a session.
 *
 * ## Credentials
 *
 * `clerkSetup` reads `CLERK_SECRET_KEY` and the publishable key from the
 * environment and exchanges them for a short-lived testing token. The guard
 * below additionally refuses anything that is not an `sk_test_` key *before*
 * we call out, so a production instance is never contacted even to be told no.
 * `.env.example` documents the three names.
 *
 * There is deliberately no anonymous fallback. If this file cannot
 * authenticate, the run must report that it could not test the signed-in
 * product rather than quietly execute every spec signed out — which is
 * precisely the failure mode T-033 exists to close, and precisely the one
 * `smoke.spec.ts`'s green tick was hiding.
 */

const AUTH_STATE_PATH = path.join(__dirname, ".auth", "user.json");

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

export default async function globalSetup(config: FullConfig) {
  const publishableKey =
    process.env.CLERK_TESTING_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey?.startsWith("sk_test_")) {
    throw new Error(
      "E2E setup refused: CLERK_SECRET_KEY must be a valid sk_test_ key. " +
        "A production key is refused on purpose — a test run must never mint a session against a live instance."
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

  // globalSetup has no page fixture, so drive a context by hand.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL: config.projects[0]?.use?.baseURL,
    });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    await page.goto("/");

    // A token that never landed is worse than no token: every downstream spec
    // would load and then assert against /sign-in. Prove Clerk actually holds a
    // session before writing the state out.
    const signedIn = await page.evaluate(() =>
      Object.keys(window.localStorage).some((k) =>
        k.toLowerCase().includes("clerk"),
      ),
    );
    expect(
      signedIn,
      "Clerk wrote no session to localStorage — the testing token was not accepted.",
    ).toBe(true);

    mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
    await context.storageState({ path: AUTH_STATE_PATH });
  } finally {
    await browser.close();
  }
}
