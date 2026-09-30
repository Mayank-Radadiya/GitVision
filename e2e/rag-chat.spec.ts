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

    const projectSelector = page.getByRole("combobox", {
      name: /Select a project for codebase chat/i,
    });
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

    // A retrieval that returns nothing renders no citation at all, so waiting
    // on the badge doubles as the groundedness assertion.
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
    await expect(
      page.getByRole("heading", { name: "Source Code", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();
    await expect(page.getByText(/^\d+ files$/)).toBeVisible();

    // The viewer silently falls back to a README/first-file auto-selection when
    // `?file=` matches nothing, so matching the breadcrumb is what proves the
    // citation resolved to a real file rather than merely navigating.
    await expect(page.getByText(citedFile ?? "", { exact: true })).toBeVisible();
  });
});
