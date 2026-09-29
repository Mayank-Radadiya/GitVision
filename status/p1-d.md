# Lane P1-D — dashboard + performance

Branch: `lane/p1-d` (off `main`). Lane D owns the dashboard regions of `src/features/dashboard/server/router/services/projectService.ts` and `db/schema.ts` (T-031).

| Task | Status | Reason | Commit |
|---|---|---|---|
| T-018 | done | Charge before enqueue, with explicit compensation for each failure window | `0f0415b` |
| T-029 | done | Measured 10 round-trips, recorded the inventory and the commit_message payload bug | `3be9f2c` |
| T-030 | done | 10 -> 3 round-trips, payload byte-identical | `5a96c81` |
| T-031 | skipped | already resolved — the premise does not reproduce; `EXPLAIN ANALYZE` on production shows no full scan. Evidence below | |

## Notes

- **T-018 depended on D-11**, which is decided: "stay on neon-http". That is the non-transactional driver, so the task explicitly rules out a real transaction and asks for a compensating delete or a documented pending state instead. No migration was needed.
- T-018 note worth carrying forward: with the reorder, an enqueue failure now happens *after* the charge, so the rollback deletes the project row **and** refunds the credits. Previously the user lost 10 credits for a project that was removed. A charge that throws outright gets the row deleted and nothing refunded, because nothing was charged.
- **T-029 must record measured numbers in a comment before T-030 merges queries** (per the lane brief), and **T-031 must record its `EXPLAIN` output** in `db/migrations/`. Both are explicit task requirements, not optional.
- Known-flaky test not caused by this lane: `src/__tests__/integration/clerk-webhook.test.ts` can time out at 5s under full-suite parallel load; it passes alone and on re-runs.

## T-031 — skipped, with the measurement that says why

T-031 asks for a generated/stored `author_date::date` column plus an index so
`getCommitChart` can group on a real column instead of
`date_trunc('day', author_date)`, and requires the `EXPLAIN` output to be
recorded. The premise is "**no index can serve a grouping on an expression**,
so every dashboard load scans the user's commits rather than reading a narrow
slice."

The first half is true. The conclusion is not, and the acceptance criterion
"the dashboard chart no longer scans all of a user's commits" is already met at
HEAD. Measured on production Neon, the same account T-029 used
(`user_2xDbTxES7iItgb95MybvzeOv3A6`, 5 projects / 402 commits, 80 commit-days):

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT date_trunc('day', c.author_date)::date::text, count(c.id)
FROM commits c JOIN projects p ON c.project_id = p.id
WHERE p.owner_id = $1 AND c.author_date >= now() - interval '7 days'
GROUP BY date_trunc('day', c.author_date) ORDER BY 1;
```

- Default 7-day window: `Index Scan using commits_author_date_idx` with
  `Index Cond: (author_date >= ...)` — the range predicate **is** index-served.
  Execution 0.085ms. (This instance has no commits in the last 7 days, so the
  scan is empty; the 2000-day run below is the one that returns real rows.)
- 2000-day window, i.e. all 402 rows and 80 groups: `Seq Scan on commits` —
  402 rows, 0.195ms, **0.588ms total execution**.

So the chart query is bounded by the user's own commit count and costs
**0.588ms at its very worst**, against a dashboard load that T-029 measured at
394ms with a 70–80ms floor that is HTTP transport per request. The whole
dashboard's server-side execution across 10 queries was 0.06–0.10ms each.

A second experiment, on a throwaway PostgreSQL 18 seeded with 4,000 commits
across 3 projects (10x the real account) to make plan differences legible
rather than noise, applied the proposed migration and re-ran both plans:

| | before (`date_trunc` group) | after (`author_day` group) |
|---|---|---|
| 4k rows, 7d | 0.316ms | 0.296ms |
| 4k rows, 365d | 1.728ms | 1.545ms |
| 40k rows, 7d | 0.503ms | 0.488ms |

The differences are within run-to-run noise, and the planner declined both
candidate indexes: it kept choosing the `commits_author_date_idx` bitmap scan
plus a `HashAggregate` over `date_trunc`, and a `(project_id, author_day)`
composite was never selected either. A single-column `author_day` index cannot
serve a grouping that is also filtered by owner through a join; the composite
could, but only in a shape this data does not have.

What the change would actually buy: a migration, a new generated column, an
extra index, write amplification on every commit insert, and schema surface —
in exchange for well under a millisecond on a query that is not the bottleneck.
Under `AGENT_RULES.md` step 2 this is `skipped: already resolved`, so no code
was changed. The throwaway database and its seed scripts were deleted; nothing
was applied to production.

**If the indexability is wanted anyway** — for instance because the commit
table is expected to grow by orders of magnitude, or because the project has a
policy of never grouping on an expression — it is a small, self-contained
change: migration `0003` adding
`author_day date GENERATED ALWAYS AS (author_date::date) STORED` plus
`CREATE INDEX commits_project_id_author_day_idx ON commits (project_id, author_day)`,
the matching `.notes.md` pre-flight report and a `db/migrations/meta/_journal.json`
entry at idx 3, `authorDay: date("author_day")` on `commitsTable`, and grouping
`getCommitChart` on it. Output is unchanged by construction because
`date_trunc('day', ts)::date` and `ts::date` are the same value.
