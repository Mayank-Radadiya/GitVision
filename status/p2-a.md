# P2 — Lane A status

Branch: `lane/p2-a` · Worktree: `/Users/aizen/Documents/Coding/NextJS/GitVision-p2a`
Spec: `TASKS.md` Phase P2 · Decision honoured: D-11 (stay on neon-http)

| Task | Status | Reason | Commit |
| --- | --- | --- | --- |
| T-037 | done | One ownership check repo-wide. `ProjectAccessError extends TRPCError` with `NOT_FOUND`, so a foreign project id answers 404 (not 500) out of a tRPC router while every `instanceof ProjectAccessError` catch in the route handlers keeps working unchanged. `verifyOwnership` deleted, 8 internal call sites repointed at the guard. | `9907918` |
| T-045 | done | **Deviation from the task text, deliberate.** The risk note said to add a `syncedAt` marker because D-11 stays on neon-http. Found `issues_project_id_issue_number_unique` on `(project_id, issue_number)` already in `db/schema.ts:292`, which allows a strictly better fix: upsert-then-prune instead of delete-then-repull. An interrupted sync can then only leave *extra* rows, never a wiped project — so the window the marker guards ("issues exist but are incomplete and unmarked") is unreachable, and no marker, no second project-level column, no reader changes. Also: `batch.find()` → one `Map` per batch, and the 2,000 cap now returns an explicit `truncated: boolean`. | `1c74f99` |
| T-050 | done | Compound keyset `(github_updated_at, id)` for issues, `(github_created_at, id)` for comments, both with over-fetch-one → slice → `{ items, hasMore, nextCursor }`. Ownership left folded in, proven by the three error-parity tests in `issue-comments-ownership.test.ts` passing untouched. **Path in the task is a typo:** it names `src/__tests__/integration/issue-comments-ownership.test.ts`; the real file is `src/__tests__/unit/issue-comments-ownership.test.ts` (a pure-mock unit test). The end-to-end "60 comments reachable" proof needs a real database, which this environment does not have — the 11 new tests prove the contract, not the SQL. | `a092b7e` |
| T-051 | done | `getFileContent` input → `z.string().uuid()` on both fields, matching its siblings. **Callers checked before enforcing, as the task required:** the only client is the code viewer (`code-viewer/index.tsx:59`), which passes `projectFiles.id`, and that column is `uuid(...).primaryKey().defaultRandom()` — nothing sends a non-uuid. `createCommitData` now takes a `GitHubCommitPayload` naming only the fields it reads; eslint-disable deleted, and the single caller (`services/commits.ts:63`) typechecks against Octokit's response unchanged. | `d35790a` |
| T-055 | done | `chats_user_id_updated_at_idx` on `(user_id, updated_at)` and `project_files_language_idx` on `(language)`, generated with `bun run db:generate` so schema and snapshot cannot drift. Rebased onto `origin/main` and re-checked `db/migrations/` first as AGENT_RULES requires — no other lane's migration had appeared. Name-collision risk the task named is covered by a real-DB assertion that `project_chats` has exactly four `chats_%` indexes. `.notes.md` follows the pattern of the three that already ship. **The new real-DB assertions are unverified: no test database in this environment.** | `4ca4d93` |
| T-056 | todo | — | — |

## Isolation: had to claim a worktree

`AGENT_RULES.md` says each agent works in its own git worktree. This lane was
dispatched into the **shared main checkout**, where a second agent is working
P1 Lane A concurrently. Two collisions happened before I moved out:

1. That agent's five in-flight files (`app/api/chat/route.ts`, `db/schema.ts`,
   `src/__tests__/unit/inngest-embeddings.test.ts`,
   `src/features/chat/components/chat-landing.tsx`,
   `src/lib/inngest/functions.ts` — an embeddings "partial/truncated" feature)
   were **staged in the shared index**. My T-037 commit used
   `git commit --only <3 paths>` so none of them leaked in.

2. The tree was moved off `lane/p2-a` to `lane/p1-a`, so my first T-037 commit
   landed on top of their P1 commits. It is preserved as `dc2c3b7` and as tag
   `p2-a-t037`; it cherry-picked cleanly onto `lane/p2-a` as `9907918`, which is
   the real commit. `lane/p1-a` still carries `dc2c3b7` on top of their
   `ff91397`/`e3ff9be`/`57de263` — **someone with write access to that branch
   should drop it** with `git branch -f lane/p1-a ff91397` from any other
   worktree. I could not: git refuses to force-update a branch used by a
   worktree.

From here on this lane works only in its own worktree and stages files by path.

## Pre-existing breakage found (not mine, not fixed)

`src/shared/components/ui/select.tsx:4` imports `@radix-ui/react-select`, but
that package is in **neither `package.json` nor `bun.lock`**. A clean
`bun install` therefore fails `bun run typecheck` on `main`. It only appears to
pass in the shared checkout because that `node_modules` has the package
installed by hand. I copied the package into this worktree's gitignored
`node_modules` to get a runnable typecheck; no tracked file was touched.
Worth a follow-up — the dependency is simply undeclared.

## Environment limitation: no test database

There is no test database here. Three `describe.skipIf(!hasTestDatabase)`
blocks in `src/__tests__/integration/credits-check-and-indexes.test.ts:12,42`
and `src/__tests__/integration/issues-unique-constraint.test.ts:19` never
execute. T-045 (truncation flag) and T-055 (real-DB index assertions) are
specified to add tests to exactly those files: they will be written but
**cannot be verified locally** and will be reported as such, not claimed green.

Baseline after T-037 in this worktree: `bun run typecheck` clean,
`bun run lint` clean, `bun run test` 34 files passed / 2 skipped,
184 tests passed / 11 skipped, 66.7s.

After T-045: 36 files passed / 2 skipped, 190 tests passed / 14 skipped.
After T-050: `bun run typecheck` clean, `bun run lint` clean, `bun run test`
**37 files passed / 2 skipped, 201 tests passed / 14 skipped, 57.2s.**
After T-051: all three green — `bun run test` **38 files passed / 2 skipped,
209 tests passed / 14 skipped, 25.7s.**
After T-055: all three green — `bun run test` **38 files passed / 2 skipped,
209 tests passed / 17 skipped, 30.9s** (the +3 skipped are the new real-DB
index assertions, which this environment cannot execute).
