import { chromium, expect, type FullConfig } from "@playwright/test";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { config as loadEnv } from "dotenv";
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

// Overridable because the password must satisfy whatever policy the instance
// enforces, and a locked-down dev instance will reject the default.
const E2E_USER_EMAIL =
  process.env.CLERK_E2E_USER_EMAIL ??
  "gitvision-e2e+clerk_test@example.com";
const E2E_USER_PASSWORD =
  process.env.CLERK_E2E_USER_PASSWORD ?? "GitVisionE2E!2026";

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
  // The Playwright runner does not read `.env`; only the `webServer` it boots
  // does, so `next dev` sees the Clerk keys and this hook does not. Without
  // this line the guard below reads `undefined` and refuses a run whose keys
  // are in fact valid, which is how T-033 shipped failing on a clean checkout.
  //
  // `clerkSetup()` loads these same two files a few lines down. It has to happen
  // earlier than that: the guard is the thing that decides whether we are
  // allowed to call out at all, and a guard cannot read a file nobody has
  // loaded yet. Precedence matches Clerk's own (`clerkSetup` is called with no
  // `dotenv: false`), and `dotenv` never overwrites a variable already present,
  // so an exported `CLERK_SECRET_KEY` still wins over the file.
  loadEnv({ path: [".env.local", ".env"] });

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

  // Exchanges the key pair for a short-lived testing token and installs the
  // route handler that attaches it to every Frontend API call.
  await clerkSetup({ publishableKey });

  // Clerk refuses to create a user on a `.test` domain and this instance
  // requires a password, so both are load-bearing rather than decorative. The
  // address is the `+clerk_test` shape Clerk's own helpers document; the
  // design's `gitvision-e2e@clerk.test` default (see `status/p1-e.md`) is
  // rejected by the API with `form_param_format_invalid`.
  //
  // 422 here is "already exists", which is every run after the first, so it is
  // the normal path and not an error to surface.
  const response = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [E2E_USER_EMAIL],
      password: E2E_USER_PASSWORD,
      first_name: "GitVision",
      last_name: "E2E",
    }),
  });
  if (response.status !== 200 && response.status !== 422) {
    throw new Error(
      `T-033: could not create the E2E Clerk user (HTTP ${response.status}): ` +
        (await response.text()).slice(0, 300),
    );
  }

  // globalSetup has no page fixture, so drive a context by hand.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL: config.projects[0]?.use?.baseURL,
    });
    const page = await context.newPage();

    // `clerk.signIn` is the step that actually establishes a session; it calls
    // `setupClerkTestingToken` internally to authorize the browser, then mints
    // a ticket sign-in for the fixture user. Without it the token is accepted
    // and no user is ever signed in — the browser holds `__clerk_db_jwt` and
    // still lands on /sign-in.
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: E2E_USER_EMAIL });

    // A state file written without a session is worse than no state file: every
    // downstream spec would load it and assert against /sign-in. Ask Clerk for
    // the user id rather than sniffing storage, because the session lives in
    // the `__session` cookie — localStorage only ever holds
    // `__clerk_environment`, which is written whether or not anyone is signed
    // in and so would pass this check while proving nothing.
    await expect
      .poll(
        () =>
          page.evaluate(() => (window as { Clerk?: { user?: { id?: string } } }).Clerk?.user?.id ?? null),
        { message: "Clerk never produced a user — the E2E sign-in did not take.", timeout: 15_000 },
      )
      .toBeTruthy();

    mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
    await context.storageState({ path: AUTH_STATE_PATH });
  } finally {
    await browser.close();
  }
}
