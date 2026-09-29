# Lane B — status (security)

Branch: `lane/p1-b` (off `main` @ `c9ffe92`)

| Task | Status | Reason | Commit |
|------|--------|--------|--------|
| T-016 | done | secret-file patterns added to `IGNORED_FILE_PATTERNS`; 15 tests added | `c222a3a` |
| T-015 | todo | | |
| T-021 | todo | | |
| T-022 | todo | | |

## Notes

- Files touched outside the lane's declared ownership: none so far.
- **Flaky, not lane B:** `src/__tests__/integration/clerk-webhook.test.ts`
  ("upserts on the primary key…") times out at the 5s default under full-suite
  parallel load. It passes when the file is run on its own and passes on re-runs
  of the full suite. Not caused by anything in this lane.
