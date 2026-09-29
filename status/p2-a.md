# P2 — Lane A status

Branch: `lane/p2-a` · Worktree: `/Users/aizen/Documents/Coding/NextJS/GitVision-p2a`
Spec: `TASKS.md` Phase P2 · Decision honoured: D-11 (stay on neon-http)

| Task | Status | Reason | Commit |
| --- | --- | --- | --- |
| T-037 | done | One ownership check repo-wide. `ProjectAccessError extends TRPCError` with `NOT_FOUND`, so a foreign project id answers 404 (not 500) out of a tRPC router while every `instanceof ProjectAccessError` catch in the route handlers keeps working unchanged. `verifyOwnership` deleted, 8 internal call sites repointed at the guard. | `9907918` |
| T-045 | todo | — | — |
| T-050 | todo | — | — |
| T-051 | todo | — | — |
| T-055 | todo | Must rebase and re-check `db/migrations/` before `db:generate`. | — |
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
