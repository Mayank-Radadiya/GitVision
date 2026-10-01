---
name: verify-change
description: Run GitVision's full verification sequence (typecheck, lint, vitest) and produce the "Verified:" line used in commit bodies. Use before claiming a change is done, before committing, or when the user asks "does this pass" / "verify" / "run the checks".
---

# Verify a change in GitVision

Runs the sequence CI runs and reports real numbers. The point is that the `Verified:` line in a commit body is a record of what actually happened — never reconstruct it from memory or from an earlier run.

## Sequence

Run these in order, stopping at the first failure so the report is about one thing:

```bash
bun run typecheck
bun run lint
bun run test
```

Then, when the change touches tested source (`src/lib/**`, `app/api/**`, `src/features/**`), also:

```bash
bun run test:coverage
```

`bun run test` does **not** enforce coverage thresholds — `test:coverage` does, and it's the one that gates CI. Skip it only for changes with no tested-source surface (docs, config, ledger edits).

## Reading the results

- **Lint baseline is 0 errors / 4 pre-existing warnings.** Report those 4 warnings as pre-existing. A 5th warning is yours.
- **Vitest skips are normal** — the DB-touching suites skip when `TEST_DATABASE_URL` is unset. Report skips as skips; don't let a skip read as a pass.
- **Coverage floors** are higher for `src/lib/**` (54/49/59/55) and `app/api/**` (41/37/31/41) than global. A drop under a floor is a real failure even when the global number passes.

## The `Verified:` line

Commit bodies in this repo end with a line in this exact shape:

```
Verified: tsc --noEmit exit 0; eslint 0 errors, 4 pre-existing warnings; vitest 579 passed / 23 skipped / 0 failed; next build succeeds
```

Fill in the actual counts from this run. Omit a clause only if you didn't run that check, and say which. Never write `next build succeeds` unless you ran `bun run build`.

## Reporting back

State each command with its real exit status and counts. If something failed, show the actual failure output — don't summarize it away, and don't describe a partial pass as a pass.
