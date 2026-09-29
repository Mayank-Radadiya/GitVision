# Lane P1-D — dashboard + performance

Branch: `lane/p1-d` (off `main`). Lane D owns the dashboard regions of `src/features/dashboard/server/router/services/projectService.ts` and `db/schema.ts` (T-031).

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-018 | done | Charge before enqueue, with explicit compensation for each failure window | PENDING |
| T-029 | todo | Measure the dashboard queries and record the numbers | |
| T-030 | todo | depends on T-029's recorded measurements | |
| T-031 | todo | Index work; needs `EXPLAIN` output recorded | |

## Notes

- **T-018 depended on D-11**, which is decided: "stay on neon-http". That is the non-transactional driver, so the task explicitly rules out a real transaction and asks for a compensating delete or a documented pending state instead. No migration was needed.
- T-018 note worth carrying forward: with the reorder, an enqueue failure now happens *after* the charge, so the rollback deletes the project row **and** refunds the credits. Previously the user lost 10 credits for a project that was removed. A charge that throws outright gets the row deleted and nothing refunded, because nothing was charged.
- **T-029 must record measured numbers in a comment before T-030 merges queries** (per the lane brief), and **T-031 must record its `EXPLAIN` output** in `db/migrations/`. Both are explicit task requirements, not optional.
- Known-flaky test not caused by this lane: `src/__tests__/integration/clerk-webhook.test.ts` can time out at 5s under full-suite parallel load; it passes alone and on re-runs.
