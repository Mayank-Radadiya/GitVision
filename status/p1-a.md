# Lane A — status

Branch: `lane/p1-a` (off `main` @ `3dec53c`)

| Task | Status | Reason | Commit |
|------|--------|--------|--------|
| T-014 | done | projectCreated + cleanupStaleData now have `onFailure`; 3 tests added | `57de263` |
| T-017 | done | `gemini-*-latest` alias replaced with pinned `gemini-2.0-flash-001`; 2 tests added | `e3ff9be` |
| T-012 | done | Prepare counts every project file; Finalize stores `partial` when the cap bit; 3 tests added | `ff91397` |
| T-013 | done | index badge now reads "Partial index — indexed N of M files" for a capped index; 5 tests added | `dda38cf` |
| T-024 | done | retention table row 2 no longer advertises a 30-day orphan sweep that does not exist | `d42c004` |
| T-028 | done | AI-triage fields dropped from both issue selects and from the insert; 4 tests added | `b0fcb1b` |

## Notes

- T-023, T-025, T-026, T-027 are **cancelled** for this lane: D-6 chose
  T-024 over T-023, and D-2 option b chose T-028, which is mutually exclusive
  with T-025/T-026/T-027.
- Files touched outside the lane's declared ownership:
  - `src/lib/llm/config.ts` and `src/lib/llm/budget.ts` (T-017). The task text
    points at `src/lib/gemini.ts` for the model id, but `LLM_SETTINGS` actually
    lives in `src/lib/llm/config.ts`; `gemini.ts` only reads
    `LLM_SETTINGS.commitSummary.model`. Edited the real definition, not the
    caller.
  - `src/__tests__/unit/budget.test.ts` (T-017). Not lane-owned, but the task's
    own verify command (`rg 'gemini.*-latest' src/`) requires every occurrence
    in `src/` to be gone, and this file pinned the old id in three assertions.
  - `app/api/chat/route.ts`, `src/features/chat/components/chat-landing.tsx`
    and `db/schema.ts` (T-012). T-012 required a stored truncation state that is
    not `"completed"`; the only honest representation is a new
    `embeddingStatus` value, and `embeddingStatus` is a plain `varchar(20)` so
    no migration was needed. Two consumers gate on `=== "completed"` and would
    otherwise have started telling users that a partially-indexed project has
    no index at all — one comparison each, plus the values comment in the
    schema. The `partial` badge itself is T-013's job.
  - T-013 added `src/features/projects/components/project-view/indexing-status-badge.tsx`
    (a new file inside the lane-owned `src/features/projects/` tree) and edited
    `project-header.tsx` + `project-page.tsx` in the same directory — all
    lane-owned, no new out-of-lane files. `projectService.ts` was deliberately
    NOT touched for T-013: `getProjectById` already returns the whole project
    row, so `embeddingStatus` / `totalFiles` / `embeddingError` already reach
    the client, and the file is lane-D-owned and already dirty.
  - `docs/operations/backup-retention.md` (T-024). Documentation-only, named
    directly by the task. Only the retention-table row for orphan code
    embeddings was rewritten. The other two rows were checked against the code
    and are accurate, so they were left alone: the rate-limit row matches the
    `cleanupStaleData` cron (functions.ts:439-450, 1h window, daily sweep), and
    the project files/commits row matches the `ON DELETE CASCADE` on
    `projectFiles.projectId` and `commitsTable.projectId` (db/schema.ts:106-108).
    Real embedding deletion: `rag-ingestion.ts:88` deletes by `fileId` before
    re-embedding, and `codeEmbeddings` cascades from both `projectId` and
    `fileId`.
  - T-028 needed no edit at all to `db/schema.ts` (the task's own
    recommendation): the three nullable columns stay, because dropping them
    costs a migration and a `.notes.md` and buys nothing user-visible. It also
    needed no edit to `src/features/dashboard/server/router/project.ts` — that
    router declares no hand-written output types for `getNeedsAttention` /
    `getIssues`, so removing the fields from the service selects is what narrows
    the tRPC output. There were no AI-triage rendering components to delete
    either: `needs-attention.tsx` only ever read `id`, `isPullRequest`, `title`,
    `projectName`, `issueNumber` and `githubUpdatedAt`, and `AttentionItem` in
    `dashboard.types.ts` never declared an AI field. So the affordance was
    advertised by comments and by the payload, never by the markup. The
    unrelated `aiSummary` in `src/lib/github/services/commits.ts` is the
    commit-summary LLM write against a different table and was left alone.
- **Foreign commit on this branch:** `dc2c3b7 [T-037] single ownership check for
  routers and route handlers` appeared above my T-012 commit without this session
  making it — a parallel agent working in this same worktree committed it. It is
  the `verifyOwnership` → `assertProjectOwnership` refactor that had been sitting
  unstaged, so `src/lib/guards.ts`, `src/__tests__/unit/guards.test.ts` and the
  `projectService.ts` region of that change are now committed rather than dirty.
  Not reverted (that would fight the other agent and could destroy their work);
  the working tree is now clean apart from lane-A edits, and the full suite was
  re-run green **with** that commit in place (197 passed / 0 failed). Whoever
  merges this branch needs to know it carries T-037 as well. The old hazard note
  about staging `projectService.ts` carefully no longer applies, since the file
  is clean at T-013 time — but T-028 should re-check `git status` first.
- **Flaky, not lane A:** `src/__tests__/integration/clerk-webhook.test.ts`
  ("upserts on the primary key…") times out at the 5s default under full-suite
  parallel load. It passes when the file is run on its own (4/4). Nothing in the
  LLM path is imported by that test. It has since passed under full-suite load
  too (T-013's run: 197 passed, 0 failed).
