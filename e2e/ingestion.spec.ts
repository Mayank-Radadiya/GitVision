import { expect, test, type Page } from "@playwright/test";

/**
 * T-034 — E2E spec for the ingestion pipeline.
 *
 * Before this, ingestion was the product's front door with zero browser-level
 * coverage: every service-level ingestion test in `src/__tests__/` mocks
 * Octokit, mocks axios, or builds a synthetic tarball in-process. A broken
 * ingest flow — a form that no longer submits, a redirect that never lands, a
 * background job that never fires — was completely invisible to CI.
 *
 * ## Repository
 *
 * `octocat/Hello-World` is already the repo this suite reaches for: it is the
 * fixture `src/__tests__/unit/rag-ingestion.test.ts:124` parses. It is the
 * smallest thing GitHub hosts, which is the point — the spec has to out-wait a
 * real Inngest run, so the fewer files there are to fetch and embed, the more
 * of the test budget goes to the pipeline instead of the payload. It carries a
 * handful of files, which keeps it far below `MAX_EMBEDDING_FILES = 500`
 * (`src/lib/inngest/functions.ts:17`), so the job lands on `completed` rather
 * than `partial`. Nothing in it matches `IGNORED_FILE_PATTERNS`
 * (`src/lib/github/constants.ts:88-131`), so the stored count is non-zero.
 *
 * ## How completion is detected
 *
 * Not from the project page, and this is the load-bearing decision of the
 * whole spec. `IndexingStatusBadge` (`src/features/projects/components/
 * project-view/indexing-status-badge.tsx:26`) branches on exactly one value —
 * `"partial"`. Everything else falls through to the same green "AI Synced"
 * badge at line 53, which means a project sitting at `pending`, mid-
 * `processing`, or dead in `failed` renders *indistinguishably* from one that
 * indexed perfectly. A spec that waited for "AI Synced" would pass on the very
 * first poll, on a project that never indexed at all.
 *
 * So completion is read from `/chat`, which is the only surface in the app
 * that actually distinguishes the states: `Indexing <name>` + a percentage
 * while processing (`chat-landing.tsx:358-394`), the indexing error plus a
 * Retry button on failure (`:405-425`), and `Ready for codebase chat` once the
 * index is usable (`:397-402`). Those three are mutually exclusive, so
 * "Ready" cannot be confused with "hasn't started" or "gave up". It is
 * re-read by re-selecting the project, because nothing on that page polls on
 * its own — the `setInterval` at `chat-landing.tsx:192` only runs after a
 * *manual* Generate click, which is not the flow under test.
 *
 * ## The file count
 *
 * `/code-viewer/<id>` renders `N files` under the "Source Code" heading
 * (`code-viewer/index.tsx:135`), read from the DOM. It is asserted > 0 because
 * it proves the tarball was streamed and committed, but it is *not* an
 * embedded-file count: `totalFiles` is written by `getRepositoryFiles`
 * (`src/lib/github/services/files.ts:68`) at creation time, before the Inngest
 * job runs. The readiness assertion above is what proves the index itself;
 * this is what proves the payload. The `indexedFileCount` / `totalFileCount`
 * columns are asserted directly in `src/__tests__/unit/inngest-embeddings.test.ts`;
 * this fixture is under the cap, so both would read 1/1 and prove nothing about
 * truncation.
 *
 * ## Prerequisites
 *
 * `createProject` calls `inngest.send`, and on failure deletes the project row
 * and refunds the credits (`projectService.ts:232-245`). The Playwright
 * `webServer` starts only `bun run dev`, so the Inngest dev server must be
 * running separately — `bun run inngest` in another terminal. This spec
 * asserts nothing about that; it fails with the app's own "please ensure the
 * background worker is running" toast if the worker is absent.
 *
 * Also needed, all live: `DATABASE_URL`, `GITHUB_TOKEN`
 * (`src/lib/github/client.ts:28-31` throws without it), `OPENROUTER_API_KEY`
 * (`src/features/rag/services/embeddings.ts:14-17`), and the Clerk test
 * instance that `e2e/global-setup.ts` authenticates.
 */

/** Poll cadence and ceiling for the background job. */
const READY_TIMEOUT_MS = 150_000;
/**
 * `GET /api/embeddings` is rate-limited to 30 reads/min/user
 * (`src/lib/rate-limit.ts:98-101`), so the poll cannot be tight or it spends
 * its own budget tripping the limiter and the run ends on a 429 instead of on
 * the thing it is testing. 5s keeps a 150s ceiling inside 30 reads.
 */
const POLL_INTERVAL_MS = 5_000;

const REPO_URL = "https://github.com/octocat/Hello-World";
const PROJECT_NAME = "E2E Octocat";

/**
 * One observation of the project's embedding state, as the UI presents it.
 * Anything that is not ready or failed is reported as still-progressing,
 * including `pending`, which the page renders as "Embeddings required" with a
 * Generate button. Deliberately never clicks that Generate button — automatic
 * ingestion is the behaviour under test, and kicking off a manual job would
 * make the spec pass for the wrong reason.
 *
 * Every observation re-loads `/chat`, and both halves of that are load-bearing:
 *
 * 1. The status only exists on `/chat`. The dashboard's one combobox is the
 *    "Sort projects" `<select>` (`project-search-bar.tsx:52`), whose options
 *    are sort orders and never a project name.
 * 2. Re-selecting the *same* project cannot refresh anything. Radix does fire
 *    `onValueChange` unconditionally on a re-pick, but React bails out of the
 *    re-render when `setSelectedProject` gets an identical value, so the
 *    `verifyStatus` effect keyed on `[selectedProject]`
 *    (`chat-landing.tsx:166-189`) never re-runs. Without the reload every
 *    poll after the first would re-read the same stale snapshot and the run
 *    would sit at "processing" until the ceiling, however long the job took.
 */
async function readEmbeddingState(page: Page): Promise<string> {
  await page.goto("/chat");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: PROJECT_NAME }).click();

  if (await page.getByText("Ready for codebase chat").isVisible())
    return "ready";
  if (await page.getByRole("button", { name: "Retry" }).isVisible())
    return "failed";
  return "progressing";
}

test.describe("ingestion", () => {
  // The project row is keyed unique on (owner_id, github_url)
  // (`db/schema.ts:96-99`), so re-submitting the same repo on a retry comes
  // back as a CONFLICT toast and the retry dies on the previous run's row
  // (projectService.ts:273-278). Retrying this test cannot work; the real
  // remedy is a unique repo per attempt. The cleanup at the bottom of the test
  // is what keeps consecutive runs off that cliff.
  test.describe.configure({ retries: 0 });

  test("a public repo is ingested and reaches a ready, non-empty index", async ({
    page,
  }) => {
    // Generous: a cold first compile on CI, then a real GitHub tarball fetch,
    // then a real embedding round-trip. The stock 5s expect timeout is
    // smaller than the pipeline it is waiting on — the UI quotes "~15s" for
    // indexing before either of those (`LiveRepoPreview.tsx:94`).
    test.setTimeout(240_000);

    // ── Submit ────────────────────────────────────────────────────────────
    await page.goto("/create-project");

    await page.getByLabel("GitHub Repository URL").fill(REPO_URL);
    await page.getByLabel("Project Name").fill(PROJECT_NAME);

    const submit = page.getByRole("button", {
      name: /Connect & Add Repository/,
    });
    // The button is `disabled` until react-hook-form validates, and repo
    // validation is debounced 250ms (`add-repo.tsx:67,94`) — clicking before
    // that is a no-op, not a failure.
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(
      page.getByText("Repository added successfully!"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);

    // ── Resolve the project id from the UI, never from a constant ──────────
    const projectLink = page.getByRole("link", { name: PROJECT_NAME });
    await expect(projectLink).toBeVisible();
    const href = await projectLink.getAttribute("href");
    const projectId = href?.split("/").pop();
    expect(projectId, "project card link carried no id").toBeTruthy();

    // ── Wait for the background job to reach a terminal state ──────────────
    // `readEmbeddingState` navigates to `/chat` itself on every observation.
    await expect
      .poll(() => readEmbeddingState(page), {
        timeout: READY_TIMEOUT_MS,
        intervals: [POLL_INTERVAL_MS],
        message:
          "embedding never reached a ready state — the background job may not " +
          "have been enqueued (is the Inngest dev server running?)",
      })
      .toBe("ready");

    // ── Assert the index has a non-zero file count, as rendered ───────────
    await page.goto(`/code-viewer/${projectId}`);

    const fileCountLabel = page.getByText(/^\d+ files?$/);
    await expect(fileCountLabel).toBeVisible();
    const fileCount = Number(
      (await fileCountLabel.textContent())?.match(/\d+/)?.[0],
    );
    expect(
      fileCount,
      "code viewer reported zero files — the tarball was never stored",
    ).toBeGreaterThan(0);

    // ── Clean up so the next run is not blocked by the uniqueness index ────
    await page.goto(`/dashboard/user-project/${projectId}`);
    await page.getByRole("button", { name: "Project actions menu" }).click();
    await page.getByRole("menuitem", { name: "Delete Project" }).click();
    // Same accessible name as the menu item that opened this dialog; the role
    // is what separates them.
    await page.getByRole("button", { name: "Delete Project" }).click();
    await expect(page.getByText("Project deleted successfully")).toBeVisible();
  });
});
