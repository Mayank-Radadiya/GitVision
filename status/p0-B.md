# Phase P0 — Lane B (projectService)

Base: `3dec53c`

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-003 | done | Both `/projects/...` hrefs pointed at a route that has never existed. | `ac0a564` |
| T-007 | done | Credit was spent before the LLM call and never refunded on failure. | `de5bf7c` |
| T-005 | blocked | Depends on D-1, which is not recorded in `TASKS.md` "Decisions made". The fix needs a human decision between the three options listed in the task (placeholder email / refuse creation / nullable email + migration). | — |

## Checks
- `bun run typecheck` — clean
- `bun run lint` — clean
- `bun run test` — 36 files passed, 2 skipped; 187 tests passed, 11 skipped (skips pre-existing)

## Notes
- T-003: new test `src/__tests__/unit/dashboard-pickup-links.test.ts` pins both hrefs and asserts every card href starts with a real route prefix (`/chat/` or `/dashboard/user-project/`), so a revert to `/projects/` fails. No `/projects` redirect was added on purpose — it would mask the next dead link.
- T-007: `getAiSummaryOfCommit` had exactly one production caller, so removing the emoji-failure sentinel could not affect any other path. The service test mocks `@/src/lib/github`, which is required anyway: the barrel throws at import without `GITHUB_TOKEN` (that is the T-010 bug in lane C).
