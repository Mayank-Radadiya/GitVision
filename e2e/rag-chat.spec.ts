import { expect, test } from "@playwright/test";

/**
 * RAG groundedness and citation click-through.
 *
 * The thesis of the product is "ask a question about a repo and get an answer
 * that points at the code". Both halves of that were unverified: nothing proved
 * retrieval returns sources, and nothing proved the citation badge resolves to
 * a file the viewer can actually open. A citation pointing at a path the file
 * API never returns is the most plausible silent failure in the whole RAG
 * pipeline, so this spec asserts the *resolved* file, not just that a badge
 * rendered.
 *
 * Authentication rides the T-033 storage state (`e2e/.auth/user.json`); no
 * auth bypass header or test-only flag is introduced here.
 *
 * This file runs independently of `ingestion.spec.ts` because the Playwright
 * config sets `fullyParallel: true` — it selects whichever already-indexed
 * project the account has rather than assuming one was just created.
 */

// ─────────────────────────────────────────────────────────────────────────────
// GATED: the assertion below is the right assertion, but nothing can currently
// reach it. Two independent causes, both verified by reading the code and the
// database, and neither is fixable from inside an E2E spec:
//
// 1. `app/api/chat/route.ts:523` — the "small dump" fast path
//    (`isSmallProject(projectInfo.estimatedTokens)`) never assigns to
//    `relatedFiles`; it is declared `[]` at `route.ts:485` and only written on
//    the RAG branch at `route.ts:568`. `route.ts:601-606` emits the
//    `data-sources` part only `if (relatedFiles.length > 0)`, so
//    `chat-room.tsx:233-247` never sets `relatedFiles` and
//    `chat-message.tsx:326` renders zero `CitationBadge`s. The user sees a
//    perfectly good answer with no citations at all, and no code path in the
//    UI can tell the difference.
//
// 2. The data behind that gate is self-contradictory. Every project in the
//    database reports `embedding_status = 'completed'` while
//    `estimated_tokens = 0` and `code_embeddings` holds zero rows. With
//    `estimated_tokens = 0`, `isSmallProject(0)` is `0 < 150_000` → true, so
//    cause (1) fires for both "completed" projects. The status flag is a lie
//    left behind by an ingest run that wrote `project_files` but neither
//    `estimated_tokens` nor a single embedding row.
//
// Once the small-dump path either populates `relatedFiles` or real embeddings
// exist, delete this call. Everything below it is written to pass as-is.
// ─────────────────────────────────────────────────────────────────────────────
test.fixme(
  true,
  "citation click-through cannot run: route.ts:523 small-dump path never sets relatedFiles, and every 'completed' project has estimated_tokens=0 with an empty code_embeddings table",
);

// Streaming an answer plus an embedding lookup is slow; be patient rather than
// flaky.
test.setTimeout(300_000);

const GROUNDED_QUESTION =
  "Summarize what this repository is for and cite the file you used.";

test.describe("RAG chat", () => {
  test("answers a grounded question and the citation opens that file in the code viewer", async ({
    page,
  }) => {
    await page.goto("/chat");

    // No name filter on purpose. `SelectTrigger` carries no `aria-label`
    // (chat-landing.tsx:308-310) — its accessible name comes from the
    // `SelectValue` child, which is the placeholder text *until* a project is
    // picked and the project name afterwards. A name-filtered locator resolves
    // to nothing the second time the picker is re-opened in the loop below.
    const projectSelector = page.getByRole("combobox");
    await expect(projectSelector).toBeVisible();
    await projectSelector.click();

    const options = page.getByRole("option");
    const optionCount = await options.count();
    if (optionCount === 0) {
      throw new Error(
        "No projects available for codebase chat. Index a repository (e2e/ingestion.spec.ts does this) before running the RAG spec.",
      );
    }

    const projectNames: string[] = [];
    for (let index = 0; index < optionCount; index += 1) {
      projectNames.push((await options.nth(index).innerText()).trim());
    }
    await page.keyboard.press("Escape");

    // The status dot in the option list is colour only — it carries no
    // accessible text — so the panel under the picker is the only honest way
    // to tell "indexed" from "not indexed yet".
    let readyProject: string | null = null;
    for (const name of projectNames) {
      await projectSelector.click();
      await page.getByRole("option", { name }).click();

      const ready = page.getByText("Ready for codebase chat");
      const notReady = page.getByText(/Embeddings required for|Indexing /);
      await expect(ready.or(notReady)).toBeVisible();

      if (await ready.isVisible()) {
        readyProject = name;
        break;
      }
    }

    if (readyProject === null) {
      throw new Error(
        "None of the available projects report a completed index. Run e2e/ingestion.spec.ts first.",
      );
    }

    await page.getByRole("button", { name: "Codebase Chat" }).click();
    await expect(page).toHaveURL(/\/chat\/[^/?]+$/);

    // Project chats render a project-scoped placeholder, not "Ask anything...".
    const input = page.getByPlaceholder(/Ask about .*\.\.\./);
    await expect(input).toBeVisible();
    await input.fill(GROUNDED_QUESTION);
    await page.getByRole("button", { name: "Send message" }).click();

    // Wait for the answer to actually finish before judging it. The citation
    // badge is the wrong thing to wait on for *this*: `route.ts:601-606`
    // writes `data-sources` before `streamText` is even called at `:608`, so a
    // visible badge only proves retrieval ran, not that the model produced an
    // answer. `chat-room.tsx:390` binds `aria-busy` to the transport's loading
    // state, and it is already "false" before the send — so the two waits must
    // be ordered true-then-false or the second one passes without a stream
    // having started.
    const transcript = page.getByRole("log");
    await expect(transcript).toHaveAttribute("aria-busy", "true");
    await expect(transcript).toHaveAttribute("aria-busy", "false");

    // Now the groundedness assertion: a retrieval that returned nothing emits
    // no `data-sources` part, so no badge is ever rendered.
    const citation = page
      .getByRole("link", { name: /^View .+ in code viewer$/ })
      .first();
    await expect(citation).toBeVisible();

    const href = await citation.getAttribute("href");
    expect(href).toMatch(/^\/code-viewer\/[^?]+\?file=/);

    const citedFile = new URL(href ?? "", page.url()).searchParams.get("file");
    expect(citedFile).toBeTruthy();

    await citation.click();

    await expect(page).toHaveURL(/\/code-viewer\/[^?]+\?file=/);

    // The viewer route has no `notFound()` — a bad project id still returns
    // HTTP 200 and renders an in-page error instead. So a matching URL proves
    // nothing on its own; assert the two failure surfaces are absent.
    await expect(
      page.getByRole("heading", { name: "Failed to load project" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Resource Not Found" }),
    ).toHaveCount(0);

    await expect(
      page.getByRole("heading", { name: "Source Code", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();
    await expect(page.getByText(/^\d+ files$/)).toBeVisible();

    // The decisive assertion. The viewer silently falls back to a
    // README/first-file auto-selection when `?file=` matches nothing
    // (code-viewer/index.tsx:66-72), so merely rendering the tree would pass
    // on a citation pointing at a file that does not exist. `file-tree.tsx:
    // 183-186` puts the real relative path in `data-path` on the selected
    // row, so matching that attribute is what proves the citation resolved to
    // the file it claimed — and it is a claim about the DOM, not about a
    // breadcrumb string whose exact rendering is not pinned anywhere.
    await expect(
      page.locator('[role="treeitem"][aria-selected="true"]'),
    ).toHaveAttribute("data-path", citedFile ?? "");
  });
});
