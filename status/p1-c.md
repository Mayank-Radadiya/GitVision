# Lane P1-C — observability

Branch: `lane/p1-c` (off `main`). Lane C owns `src/lib/logger.ts` + `src/lib/logger.test.ts`.

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-019 | done | Logger redaction at all four levels, deep through `context` and errors | `f6e00ab` |
| T-020 | todo | depends on D-4, which is not in TASKS.md "Decisions made" | |

## Notes

- **T-020 will be `blocked`**: its `Depends on` is `D-4, T-019`, and **D-4 is not listed in "Decisions made"**. Nothing will be implemented for it; the status row above will be updated to record the block rather than leaving it `todo`.
- T-019 touched only lane-owned files (`src/lib/logger.ts`, `src/__tests__/unit/logger.test.ts`). No files outside the lane's declared ownership.
- T-019 behaviour notes for whoever picks up T-020: the redaction lives in `serialize()`/`redact()` in `src/lib/logger.ts` and runs on the single path every level uses, so a transport added later must call `serialize` (or `redact`) rather than formatting its own payload, otherwise redaction is bypassed. `debug` is still gated on `NODE_ENV !== "production"`.
- Known-flaky test not caused by this lane: `src/__tests__/integration/clerk-webhook.test.ts` can time out at 5s under full-suite parallel load; it passes alone and on re-runs.
