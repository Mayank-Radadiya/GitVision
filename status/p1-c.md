# Lane P1-C — observability

Branch: `lane/p1-c` (off `main`). Lane C owns `src/lib/logger.ts` + `src/lib/logger.test.ts`.

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-019 | done | Logger redaction at all four levels, deep through `context` and errors | `f6e00ab` |
| T-020 | blocked | depends on D-4 (error-tracking transport) which is not in "Decisions made" | |

## Notes

- **T-020 is `blocked`, not skipped and not implemented.** Its `Depends on` is `D-4, T-019`. T-019 is done, but **D-4 has no decision**: TASKS.md "Decisions made" (lines 18-25) lists D-2, D-3, D-5, D-6, D-9, D-11, D-12 only, while `TASKS.md:1371-1374` still presents the three open options (Sentry · OpenTelemetry Collector · keep console and ship logs somewhere that aggregates them) with none chosen. The task's own step 1 is "Implement the D-4 transport" and step 2 says the routing decision comes "per the D-4 decision", so there is nothing to implement without a human choice.
- Unblock path: decide D-4, then implement behind an environment flag so local and CI keep console-only output. The transport must call `serialize`/`redact` from `src/lib/logger.ts` rather than formatting its own payload, otherwise T-019's redaction is bypassed — that acceptance criterion is the whole reason the redaction lives in one shared function. It must stay off in local and CI, and the choice should be reviewed against the retention policy in `docs/operations/backup-retention.md` (TASKS.md:439 notes this is where prompt/customer data would accumulate).
- T-019 touched only lane-owned files (`src/lib/logger.ts`, `src/__tests__/unit/logger.test.ts`). No files outside the lane's declared ownership.
- T-019 implementation notes for whoever picks up T-020: `src/lib/logger.ts` now has `REDACTED_KEY_PATTERN`, `REDACTED = "[REDACTED]"`, `MAX_STRING_LENGTH = 2000`, `MAX_DEPTH = 8`, plus `truncate()`, `redact()` and a shared `serialize(level, message, extra?)` that all four levels use. The logged `Error` is still expanded to `{ name, message, stack }` first (an `Error`'s own `message`/`stack` are non-enumerable, so passing an `Error` straight into `redact` would silently drop them). `debug` remains gated on `NODE_ENV !== "production"`.
- Known-flaky test not caused by this lane: `src/__tests__/integration/clerk-webhook.test.ts` can time out at 5s under full-suite parallel load; it passes alone and on re-runs.

