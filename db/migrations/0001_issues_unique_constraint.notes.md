```sql
-- Dedupe report for issues_project_id_issue_number_unique.
--
-- Run this BEFORE applying the migration. If it returns any rows, the
-- ALTER TABLE in 0001 will fail and the migration must not be applied yet.
--
-- Read-only: no writes, no locks beyond an ACCESS SHARE on the table.

SELECT
  project_id,
  issue_number,
  count(*) AS copies,
  array_agg(id ORDER BY created_at) AS ids_in_order,
  min(created_at) AS oldest,
  max(created_at) AS newest
FROM issues
GROUP BY project_id, issue_number
HAVING count(*) > 1
ORDER BY copies DESC, project_id, issue_number
LIMIT 100;
```

## Proposed dedupe strategy

If the query above returns rows, `ALTER TABLE ... ADD CONSTRAINT UNIQUE` aborts
and no partial change is made, so it is safe to run repeatedly.

1. **Keep the most recently synced copy, delete the rest.** The sync writes
   `github_updated_at` and `created_at` on every pull, so the newest row is the
   one that matches the current GitHub state.

```sql
-- Keep the row with the greatest github_updated_at; ties break to the
-- greatest created_at. Everything ranked 2 or worse is deleted.
DELETE FROM issues
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY project_id, issue_number
        ORDER BY github_updated_at DESC, created_at DESC, id
      ) AS rn
    FROM issues
    WHERE (project_id, issue_number) IN (/* from the report */)
  ) ranked
  WHERE ranked.rn > 1
);
```

Delete by `id`, never with a broad `DELETE ... WHERE project_id = ...`, so the
blast radius is exactly the reported duplicates.

2. **Re-run the read-only report.** It must return zero rows. Only then apply.

3. **Apply the migration in a transaction** so the constraint and any future
   index builds roll back together:

```sql
BEGIN;
ALTER TABLE "issues"
  ADD CONSTRAINT "issues_project_id_issue_number_unique"
  UNIQUE ("project_id","issue_number");
COMMIT;
```

## Adding UNIQUE is a blocking operation

`ALTER TABLE ... ADD CONSTRAINT` takes an ACCESS EXCLUSIVE lock for the whole
build, so it blocks reads and writes on `issues` until it finishes. This is
acceptable at current table size (a plain `UNIQUE` constraint builds a btree
index in one pass, no table rewrite). It is NOT acceptable once `issues` grows
large. If a future migration needs this constraint on a big table, the online
path is: create the unique index concurrently against a clean table
(`CREATE UNIQUE INDEX CONCURRENTLY`), then attach it with a short
`ALTER TABLE ... ADD CONSTRAINT ... USING INDEX`, which only takes a brief
lock. `CONCURRENTLY` cannot run inside a transaction, which is why it is not
used here.

Measure before applying on production:

```sql
SELECT
  pg_size_pretty(pg_total_relation_size('issues')) AS total,
  pg_size_pretty(pg_relation_size('issues'))       AS heap,
  count(*)                                        AS rows
FROM issues;
```

If `rows` is in the low millions and the total is well under a few GB, the
blocking form is a sub-second operation and fine. Check the current value
first; if it is large, use the concurrent path above instead of this file.
