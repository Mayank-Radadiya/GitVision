-- Pre-flight report for 0003_melodic_giant_girl.sql
--
-- Run these BEFORE applying. Read-only: no writes, no DDL.

## What this migration does

Two plain `CREATE INDEX` statements, no constraints and no data changes:

1. `chats_user_id_updated_at_idx` on `project_chats (user_id, updated_at)` —
   `getAll` pages chats with a keyset cursor: `WHERE user_id = $1 ORDER BY
   updated_at DESC, id DESC LIMIT n`. The single-column `chats_user_id_idx`
   that already exists can filter by `user_id` but cannot serve the sort, so
   every page paid for one. A composite index on `(user_id, updated_at)`
   answers both halves of the same query from one scan.
2. `project_files_language_idx` on `project_files (language)` —
   `getLanguageBreakdown` runs `selectDistinct(language)` over the whole
   table. Without an index that is a full scan of the table holding every
   source file, which is the widest non-vector table in this schema.

## 1. CHECK — do these indexes already exist under another name?

A previous `drizzle-kit push` may have created equivalents. A duplicate index
is pure write overhead, and the names here were chosen to match the schema,
so a mismatch is a real signal rather than a harmless difference.

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('project_chats', 'project_files')
ORDER BY tablename, indexname;
```

Expect `project_chats` to show exactly four `chats_%` indexes —
`chats_project_id_idx`, `chats_user_id_idx`, `chats_type_idx` from `0000`, and
`chats_user_id_updated_at_idx` from this file. Five means something else
already covers the same access path; decide whether to drop the redundant one
rather than leaving both to be maintained on every write.

## 2. Size the tables first

```sql
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total,
  pg_size_pretty(pg_relation_size(relid))       AS heap,
  n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE relname IN ('project_chats', 'project_files')
ORDER BY pg_total_relation_size(relid) DESC;
```

An index build costs roughly one sequential scan of the heap, so expect a
sub-second build while `project_files` stays in the low hundreds of MB. Neither
table here is in the same league as `code_embeddings`, which is the expensive
one and is already indexed by `0002`.

The cost depends on the table width, not the width of the indexed columns:
Postgres reads the whole heap to build any index. `project_files` carries the
full source of every file, so it is the one to watch; `project_chats` holds
titles only and is trivial.

If `project_files` has grown past your maintenance window, take the online
path instead — but not inside a transaction:

```sql
CREATE INDEX CONCURRENTLY project_files_language_idx
  ON project_files (language);
```

`CONCURRENTLY` cannot run in a transaction block, and drizzle applies a
generated migration as a single unit, so a generated migration must use the
plain form. That is acceptable here: `CREATE INDEX` permits concurrent reads
and writes, so the only thing it blocks is other DDL.

## 3. Verify after applying

```sql
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname IN (
  'chats_user_id_updated_at_idx',
  'project_files_language_idx'
);
```

Expect two rows, with `user_id, updated_at` in that order on the first. Column
order matters: `(user_id, updated_at)` serves the cursor query, the reverse
would not.

```sql
SELECT count(*) AS leftover_invalid_indexes
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE NOT i.indisvalid
  AND c.relname LIKE '%_idx';
```

Expect 0. Anything else is an index that failed to build and must be dropped
and rebuilt.

## 4. Confirm the planner actually uses them

An index that exists but is never chosen is dead write overhead. Force the
cursor query with realistic parameters and check the plan uses the new index:

```sql
EXPLAIN
SELECT id, title, updated_at
FROM project_chats
WHERE user_id = '<a real user id>'
ORDER BY updated_at DESC, id DESC
LIMIT 20;
```

Look for `Index Scan using chats_user_id_updated_at_idx` and the absence of a
`Sort` node. If Postgres still sorts, the table is small enough that the
planner prefers a sequential scan — which is fine, and means the index is
insurance against the table growing rather than a fix for a live incident.
