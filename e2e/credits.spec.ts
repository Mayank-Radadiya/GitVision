import { expect, test, type Page } from "@playwright/test";

/**
 * Credit gating: what a user hits once the meter runs dry.
 *
 * Credits are the product's only spend control, and both gates were untested:
 * project creation rejects before charging, and the chat endpoint answers 402
 * once a turn cannot be paid for. A regression in either one silently hands out
 * free usage — or, worse, blocks paying users with no explanation.
 *
 * The balance is zeroed straight from the `users` table rather than drained
 * through the UI, which would cost ten real project creations. That is a
 * test-side fixture: no application code, auth header, or test flag is touched,
 * and the strict "no auth bypass in application logic" invariant holds. The
 * balance is restored when the file finishes.
 *
 * A general chat is used for the chat half on purpose: the turn is charged in
 * `app/api/chat/route.ts` before any project enrichment happens, so the 402
 * path is reachable without indexing a repository first.
 */

const INSUFFICIENT_CREDITS_MESSAGE =
  "Insufficient AI credits. You need 10 credits to create a project.";
const OUT_OF_CREDITS_MESSAGE =
  "You're out of credits. Please top up to continue chatting.";

const BLOCKED_PROJECT_NAME = `Blocked Project E2E ${Date.now()}`;
const TINY_REPO_URL = "https://github.com/octocat/Hello-World";

let originalCredits: number | null = null;
let restoreCredits: (() => Promise<void>) | null = null;

async function zeroCredits(page: Page): Promise<void> {
  // Playwright runs outside Next.js, so nothing has read `.env` yet.
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // Surfaced by the explicit check below.
    }
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is unset. This spec writes the credit balance directly; export DATABASE_URL (or keep .env in the repo root) before running the E2E suite.",
    );
  }

  const { db } = await import("../db");
  const { usersTable } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const userId = await page.evaluate(async () => {
    const clerk = (
      window as unknown as {
        Clerk?: { load?: () => Promise<unknown>; user?: { id?: string } };
      }
    ).Clerk;
    await clerk?.load?.();
    return clerk?.user?.id ?? null;
  });

  if (!userId) {
    throw new Error(
      "window.Clerk.user.id was unavailable, so the credit fixture cannot target the signed-in user.",
    );
  }

  const [row] = await db
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!row) {
    throw new Error(
      `No users row for Clerk id ${userId}; the account has never hit the app.`,
    );
  }

  originalCredits = row.credits;
  await db
    .update(usersTable)
    .set({ credits: 0 })
    .where(eq(usersTable.id, userId));

  restoreCredits = async () => {
    if (originalCredits === null) return;
    await db
      .update(usersTable)
      .set({ credits: originalCredits })
      .where(eq(usersTable.id, userId));
  };
}

test.setTimeout(180_000);

test.describe("Credit exhaustion", () => {
  // The two halves share one zeroed balance, so they must not race.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await zeroCredits(page);
  });

  test.afterAll(async () => {
    await restoreCredits?.();
  });

  test("blocks project creation and explains why", async ({ page }) => {
    await page.goto("/create-project");

    await page.getByLabel("Project Name").fill(BLOCKED_PROJECT_NAME);
    await page.getByLabel("GitHub Repository URL").fill(TINY_REPO_URL);
    await expect(page.getByText("Verified")).toBeVisible();

    await page.getByRole("button", { name: "Connect & Add Repository" }).click();

    // `useCreateProject` surfaces `error.message` through a toast and nothing
    // else, so the toast is the only place this explanation exists in the DOM.
    await expect(page.getByText(INSUFFICIENT_CREDITS_MESSAGE)).toBeVisible();

    // A rejected create must not navigate or create anything.
    await expect(page).toHaveURL(/\/create-project/);
  });

  test("blocks a chat turn and explains why", async ({ page }) => {
    await page.goto("/chat");

    await page.getByRole("button", { name: "General Chat" }).click();
    await expect(page).toHaveURL(/\/chat\/[^/?]+$/);

    const input = page.getByPlaceholder("Ask anything...");
    await expect(input).toBeVisible();
    await input.fill("What does this project do?");
    await page.getByRole("button", { name: "Send message" }).click();

    // The 402 is mapped to `out_of_credits`, which is non-retryable — hence the
    // absent "Try again" button, which is part of the contract.
    await expect(page.getByText("Out of credits:")).toBeVisible();
    await expect(page.getByText(OUT_OF_CREDITS_MESSAGE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  });
});
