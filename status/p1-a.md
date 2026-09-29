# Lane A — status

Branch: `lane/p1-a` (off `main` @ `3dec53c`)

| Task | Status | Reason | Commit |
|------|--------|--------|--------|
| T-014 | done | projectCreated + cleanupStaleData now have `onFailure`; 3 tests added | (below) |
| T-017 | todo | | |
| T-012 | todo | | |
| T-013 | todo | | |
| T-024 | todo | | |
| T-028 | todo | | |

## Notes

- T-023, T-025, T-026, T-027 are **cancelled** for this lane: D-6 chose
  T-024 over T-023, and D-2 option b chose T-028, which is mutually exclusive
  with T-025/T-026/T-027.
- Files touched outside the lane's declared ownership: none.
- **Pre-existing, not mine:** `src/__tests__/unit/guards.test.ts` is modified
  and uncommitted in the working tree (2 failing tests). It was present before
  lane A started, is unrelated to any P1 task, and is deliberately left
  untouched and unstaged. Full-suite `bun run test` therefore reports 2 failures
  until whoever made that change resolves it; every other test file passes.
