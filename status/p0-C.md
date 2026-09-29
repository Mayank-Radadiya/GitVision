# Phase P0 — Lane C (CI + infra)

Base: `3dec53c`

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-008 | done | CI installed `bun-version: latest`, overriding the `packageManager` pin. | `b6924a6` |
| T-010 | done | Missing `GITHUB_TOKEN` threw at module load and 500ed every tRPC call. | `158df20` |
| T-001 | done | The database was never dumped; the doc said so. D-12 is recorded, so this is unblocked. | `477b1f4` |

## Checks
- `bun run typecheck` — clean
- `bun run lint` — clean
- `bun run test` — 35 files passed, 2 skipped; 185 tests passed, 11 skipped (skips pre-existing)
- `env -u GITHUB_TOKEN bun run build` — succeeds (this is T-010's acceptance criterion)
- `bun run db:backup` — exits 0, writes a verified ~1.2 MB dump

## Files touched outside the lane
- `src/lib/github/services/commits.ts`, `project.ts`, `issues.ts` — T-010 changed the client
  export from a module-scope `octokit` to `getOctokit()`. Three call sites inside the same
  module had to follow. `commits.ts` is also lane B's file; the change is one import line plus
  one `const octokit = getOctokit();` per function.
- `src/__tests__/unit/repo-size-limit.test.ts` — mocked the old `octokit` export shape. One
  property renamed; no assertion changed.

## Notes
- T-008: setup-bun already resolves the version from `packageManager` when no version is
  given, so the fix was deleting the `with:` block rather than adding a pin. Confirmed against
  the upstream README. The `--frozen-lockfile` gate is untouched.
- T-010: CI no longer sets a placeholder `GITHUB_TOKEN`. It only existed because the build
  needed one at import time; its removal makes CI prove the build works without one. Fail-fast
  is preserved — the error still names the variable, it just fires on first use.
- T-001: the workflow is correct but the artifact is not the durable home D-12 calls for.
  Until the S3 bucket exists, retention is capped at the workflow's 14 days and a restore drill
  is still outstanding. Both are stated in the doc rather than left implied.
- Running `bun run db:backup` locally produced a real dump of the configured database at
  `../gitvision-backups/gitvision_backup_<timestamp>.sql`. That is the script's designed output
  location, outside the repo, but it is production data on disk — delete it if unwanted.
