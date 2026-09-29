-- Pre-flight report for 0002_credits_check_and_hot_path_indexes.sql
--
-- Run these BEFORE applying. Read-only: no writes, no DDL.

## 1. CHECK (credits >= 0) — will the constraint apply?

`ALTER TABLE ... ADD CONSTRAINT ... CHECK` scans every existing row. If any
balance is already negative the statement fails and nothing is applied.

```sql
SELECT id, email, credits
FROM users
WHERE credits < 0
ORDER BY credits;
```

If this returns rows, fix them before applying. Credits are a real balance, so
a negative row is a bug that already reached storage — correct the balance to
the true owed amount, do not clamp blindly to 0 unless that is in fact the
correct balance:

```sql
-- Only after confirming the true balance for each affected user.
UPDATE users SET credits = 0 WHERE id = '<id>' AND credits < 0;
```

## 2. Index build cost and lock behaviour

Five of the six statements here are `CREATE INDEX`, which is blocking but not
table-rewriting: Postgres takes a SHARE lock that permits reads and writes and
only blocks other DDL. Under a transaction they take a stronger lock for the
whole transaction — see the note at the bottom.

Size the tables first:

```sql
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total,
  pg_size_pretty(pg_relation_size(relid))       AS heap,
  n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE relname IN (
  'issues', 'code_embeddings', 'rate_limits', 'users'
)
ORDER BY pg_total_relation_size(relid) DESC;
```

Expected cost, as a rule of thumb: an index build takes roughly as long as a
sequential scan of the heap, so a few hundred MB of heap is a sub-second to
few-second build; a few GB is minutes.

Which statement is the expensive one, in order:

1. `code_embeddings_project_id_file_path_idx` — `code_embeddings` is the
   largest table in this schema by a wide margin: one row per chunk, each
   carrying a 768-dimension vector, so the heap is an order of magnitude
   bigger than every other table here. This index is the one to watch.
2. `issues_project_id_is_pull_request_github_updated_at_idx` — three columns,
   but `issues` is small relative to `code_embeddings`.
3. `issues_state_idx` and `issues_github_updated_at_idx` — single narrow
   columns on a small table. Cheap.
4. `rate_limits_window_start_idx` — one timestamp. Cheap, and it stops the
   nightly cleanup job from scanning the whole table.

Note the cost is independent of the row width on the *key* columns, not the
table width: Postgres reads the whole heap to build any index. So the wide
`code_embeddings` table costs the most regardless of how narrow its indexed
columns are.

If a build is too slow for your maintenance window, take the online path
instead — but not inside a transaction:

```sql
CREATE INDEX CONCURRENTLY code_embeddings_project_id_file_path_idx
  ON code_embeddings (project_id, file_path);
```

`CONCURRENTLY` cannot run in a transaction block, so run it as a standalone
statement and check for a leftover invalid index (`pg_index.indisvalid = false`)
before moving on. Drop and recreate if one is left behind.

## 3. Do the indexes already exist under another name?

Before applying, in case a previous `drizzle-kit push` created equivalents by
a different name — a duplicate index is pure write overhead:

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('issues', 'code_embeddings', 'rate_limits')
ORDER BY tablename, indexname;
```

## 4. Why plain CREATE INDEX, and the transaction caveat

Drizzle applies a generated migration file inside a single transaction, and
Neon serverless connections issue each migration as one unit. `CREATE INDEX
CONCURRENTLY` is illegal inside a transaction block, so a generated migration
must use the plain form. That is acceptable here: `CREATE INDEX` allows
concurrent reads and writes, so the only thing it blocks is other DDL.

The trade-off is the lock the surrounding transaction holds for longer, and
that `ALTER TABLE ... ADD CONSTRAINT ... CHECK` in statement 6 takes an
ACCESS EXCLUSIVE lock while it validates the whole `users` table. `users` is
the smallest table in the schema, so that is a sub-second block in practice —
verify with the sizing query above rather than assuming.

## 5. Verify after applying

```sql
SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass AND contype = 'c';
```

Expect one row: `users_credits_non_negative` with `CHECK ((credits >= 0))`.

```sql
SELECT count(*) AS leftover_invalid_indexes
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE NOT i.indisvalid
  AND c.relname LIKE '%_idx';
```

Expect 0. Anything else is an index that failed to build and must be dropped
and rebuilt.
