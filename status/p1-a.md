# Lane A — status

Branch: `lane/p1-a` (off `main` @ `3dec53c`)

| Task | Status | Reason | Commit |
|------|--------|--------|--------|
| T-014 | done | projectCreated + cleanupStaleData now have `onFailure`; 3 tests added | `57de263` |
| T-017 | done | `gemini-*-latest` alias replaced with pinned `gemini-2.0-flash-001`; 2 tests added | (below) |
| T-012 | todo | | |
| T-013 | todo | | |
| T-024 | todo | | |
| T-028 | todo | | |

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
- **Pre-existing, not mine:** `src/__tests__/unit/guards.test.ts` was already
  modified and uncommitted before lane A started, and `src/lib/guards.ts` became
  modified part-way through T-017. Neither is related to any P1 task; both are
  deliberately left untouched and unstaged. The two `guards.test.ts` failures
  they caused have since stopped reproducing, but any future failure in those
  two files is not lane A's doing.
- **Flaky, not lane A:** `src/__tests__/integration/clerk-webhook.test.ts`
  ("upserts on the primary key…") times out at the 5s default under full-suite
  parallel load. It passes when the file is run on its own (4/4). Nothing in the
  LLM path is imported by that test.
