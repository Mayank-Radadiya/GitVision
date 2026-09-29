-- Pre-flight report for 0003_commits_project_id_author_date_idx.sql
--
-- One statement: a composite btree on commits(project_id, author_date).
-- Read-only checks first; nothing here writes.

## 1. What this is for

`getCommitChart` (`src/features/dashboard/server/router/services/projectService.ts`)
groups a user's commits by day inside a date window:

    FROM commits JOIN projects ON commits.project_id = projects.id
    WHERE projects.owner_id = $1 AND commits.author_date >= $2
    GROUP BY date_trunc('day', commits.author_date)

`commits_author_date_idx` is on `author_date` alone and `commits_project_id_idx`
is on `project_id` alone. Neither can serve both the join equality and the date
range, so Postgres falls back to a sequential scan of `commits`, filtered on
`author_date`, and then joins. On a multi-tenant table that scan reads every
commit by *every* user inside the window, not just the caller's. The composite
gives the join an equality probe per project and lets `author_date` serve the
range, so the read is bounded by one user's own commits.

## 2. Honest statement of what is measurable today

On the development database this migration changes no measured number, and the
commit records that plainly. At the time of writing `commits` held 402 rows in
33 pages and there is exactly one user, so:

    Seq Scan on commits  (cost=0.00..38.02 rows=276)  (actual time=0.010..0.097 rows=274)
      Filter: (author_date >= $2)
      Rows Removed by Filter: 128
      Buffers: shared hit=33
    Execution Time: 0.319 ms

Forcing a seq scan off does not make the planner prefer the new index either —
at this size it uses the existing `commits_author_date_idx` instead. The
planner is right: on a 33-page table, a scan is cheaper than five index probes.
This index is **scale insurance, not a speedup**, and the plan will keep saying
"Seq Scan on commits" until `commits` is large enough for the planner to
prefer the index. Do not read a seq scan in a later `EXPLAIN` as a sign this
migration was wasted.

## 3. Index build cost and lock behaviour

One `CREATE INDEX`, no constraint, no table rewrite. Postgres takes a SHARE
lock, which permits reads and writes and blocks only other DDL.

Size the table first:

    SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total,
           n_live_tup AS approx_rows
    FROM pg_stat_user_tables WHERE relname = 'commits';

A btree build costs roughly a sequential scan of the heap. `commits` is
narrow — no vector column, unlike `code_embeddings` — so a few hundred MB is a
sub-second build and a few GB is minutes. If that is too long for the
maintenance window, take the online path, but not inside a transaction:

    CREATE INDEX CONCURRENTLY commits_project_id_author_date_idx
      ON commits (project_id, author_date);

`CONCURRENTLY` is illegal in a transaction block, and drizzle applies a
generated migration inside one, so the committed SQL uses the plain form.

## 4. Does an equivalent index already exist?

A previous `drizzle-kit push` may have created one under a different name; a
duplicate is pure write overhead on every commit insert.

    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'commits' ORDER BY indexname;

Expect `commits_project_id_idx`, `commits_author_date_idx`,
`commits_commit_hash_idx`, `commits_commit_hash_project_id_unique` and the new
`commits_project_id_author_date_idx`. If something already covers
(project_id, author_date) under another name, drop this migration instead.

## 5. Cost of keeping it

`commits` is written once per commit and read on every dashboard load, so this
index adds one write amplification per row to save a scan on the read side. It
is two narrow columns (a uuid and a timestamp) — a few dozen bytes per row —
against `commits_commit_message`, which is unbounded. If `commits` ever grows
large enough that the write cost shows up, revisit this alongside the
`commit_message` cap already flagged in `projectService.ts`.

## 6. Verify after applying

    SELECT indexname, indexdef FROM pg_indexes
    WHERE indexname = 'commits_project_id_author_date_idx';

Expect one row whose definition is
`CREATE INDEX ... ON public.commits USING btree (project_id, author_date)`.

    SELECT count(*) AS leftover_invalid_indexes
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE NOT i.indisvalid AND c.relname LIKE '%_idx';

Expect 0. Anything else is an index that failed to build; drop and rebuild it.
