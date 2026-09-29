# Phase P0 — Lane D (ingest + edge)

Base: `3dec53c`

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-004 | done | Gunzip stream had no error handler; a corrupt tarball was an uncaught exception. | `a9eed54` |
| T-002 | skipped | Already resolved at HEAD. `/api/health` is in `proxy.ts` `PUBLIC_ROUTES`, `projectName` is already absent from the public degraded list, `proxy-allowlist.test.ts` already lists it under `PUBLIC`, and `health-endpoint.test.ts:197-213` already has a signed-out reachability case that goes through the real middleware. | — |
| T-009 | done | Both routes had zero production callers and no rate limiting. | `7464b8c` |

## Checks
- `bun run typecheck` — clean
- `bun run lint` — clean
- `bun run test -- health-endpoint proxy-allowlist github-tarball-stream` — passing
- Full suite — see final report

## Notes
- T-004: the fix is a `.on("error")` on the gunzip stream. A second, smaller change in the same function: `getRepositoryFiles` wrapped every failure in a `GitHubError` whose message was the constant `"Failed to fetch repository files"`, discarding the cause. That message is what reaches the Inngest retry log, so the reason is now appended. Without the handler, vitest reports an *unhandled error* rather than a clean assertion failure — that unhandled error was the production bug.
- T-002 needed no work; recorded as `skipped: already resolved` per the per-task loop, and re-confirmed with the task's own verify commands.
- T-009: `src/features/projects/hooks/use-create-project.tsx:9` mentions `/api/project/createProject` in a comment, but that route does not exist either and the comment is historical — left alone. The tRPC `getProjectCommits` procedure (`projectService.ts:278`, router `project.ts:71`) is untouched.
