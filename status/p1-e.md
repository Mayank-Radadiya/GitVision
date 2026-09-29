# Lane P1-E — e2e

Branch: `lane/p1-e` (off `main` @ `c9ffe92`). Lane E owns `e2e/**`, `playwright.config.ts` and `.github/workflows/ci.yml`.

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-032 | done | The suite now boots its own server; `bun run test:e2e` passes from a cold start | `9746a25` |
| T-033 | todo | | |
| T-034 | todo | | |
| T-035 | todo | | |
| T-036 | todo | | |

## Notes

- **T-032 depends on T-010 in practice, not on paper.** `TASKS.md` lists T-032's `Depends on` as `none`, but the task text and its notes both say the app must boot without a real GitHub token, and attribute that to T-010. T-010 is still `Status: todo` and `src/lib/github/client.ts:18-20` still throws at module load when `GITHUB_TOKEN` is unset. Worked around with a placeholder in the `webServer` env; T-010 removes the need. The workaround is conditional on the absence of a `.env` so it cannot shadow a developer's real token.
- **T-034 is likely `blocked`:** its acceptance is "reverting T-003 makes this test fail", and T-003 is still `Status: todo` — `projectService.ts:664` and `:680` still emit the dead `/projects/...` hrefs, so there is nothing to revert.
- **T-033/T-034/T-035 must not add an auth bypass.** The tasks say so explicitly and so does the lane brief: no `NODE_ENV=test` escape hatch in `proxy.ts`, no bypass header. If Clerk cannot run in CI the answer is a dedicated test instance.
- Known-flaky test not caused by this lane: `src/__tests__/integration/clerk-webhook.test.ts` can time out at 5s under full-suite parallel load; it passes alone and on re-runs.
