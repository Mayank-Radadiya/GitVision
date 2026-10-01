# 0015 — `projects.embedding_status` CHECK constraint

> **Status: not executed.** Generated and reviewed, not applied to any database.
> The SQL below is what `drizzle-kit migrate` will run.

## 1. What it is for

```sql
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_embedding_status_check"
  CHECK ("embedding_status" IN ('pending', 'processing', 'completed', 'partial', 'failed'))
  NOT VALID;
ALTER TABLE "projects" VALIDATE CONSTRAINT "projects_embedding_status_check";
```

`embedding_status` has been `varchar(20) NOT NULL DEFAULT 'pending'` since
`0000_absent_moonstone.sql`, with no constraint and no Postgres enum. The legal
values were declared in three places that could not see each other: a comment on
`db/schema.ts:114`, `TERMINAL_EMBEDDING_STATUSES` in `src/lib/embedding-progress.ts`,
and a bare literal at each of the 13 sites that wrote the column. A typo in any
one of them would have been stored silently and then read by the health check, the
UI badge, and the chat route's readiness gate — none of which distinguish an
unknown status from `pending`.

This constraint makes the database the authority on the vocabulary.
`src/lib/indexing-status.ts` declares the same five values for TypeScript, so a
typo is a compile error rather than a stored bad value, and the two lists are
checked against each other by `unit/indexing-status.test.ts`.

## 2. Why `NOT VALID` then `VALIDATE`

Adding a CHECK to an existing table validates every row while holding a lock that
blocks reads and writes for the duration. On `projects` — one row per indexed
repo, written by the embedding pipeline rather than by request traffic — that
would be a brief stall, not an outage. The two-step form avoids paying it anyway:

- `ADD CONSTRAINT ... NOT VALID` takes a brief lock to record the rule, then
  releases. New writes are checked from that point on.
- `VALIDATE CONSTRAINT` re-checks existing rows under a weaker lock
  (`SHARE UPDATE EXCLUSIVE`), which does not block reads or writes.

Both statements must succeed for the migration to be meaningful. If `VALIDATE`
is skipped, the constraint exists but existing rows were never inspected.

## 3. Why the values are exactly these five

`pending` and `processing` are the non-terminal pair. `completed`, `partial`, and
`failed` are terminal. `partial` is the one that is easy to leave out: it is
written only when a repo exceeds `MAX_EMBEDDING_FILES`, it is enumerated once in
`embedding-progress.ts`, and only two readers act on it — the chat route's
readiness gate and the indexing badge. Without it in this list, capping a repo
would fail the migration instead of producing a working partial index.

The constraint deliberately does **not** encode which transition is legal from
which state. That is a temporal property — it depends on which run holds the
claim — and a row-level CHECK cannot see the claim. It lives in
`src/lib/indexing-state.ts`, where each write carries its own guard.

## 4. What the migration does not fix

There is no index on `embedding_status`. The health check's "stuck in
`processing`" query and the reset script's bulk update would both benefit from
one, but neither runs on request traffic and the projects table is small. Adding
it speculatively would be a cost paid on every insert for a query that runs on a
cron.

There is no transition trigger. A trigger could reject `completed → processing`,
but `completed → processing` is a legitimate re-index, and every other legal
transition has a legitimate inverse. The guards are the enforcement.

## 5. Verification

Not run — see the status note at the top. To verify after applying:

```sql
-- The constraint exists and is validated.
SELECT conname, convalidated
  FROM pg_constraint
 WHERE conrelid = 'projects'::regclass
   AND conname = 'projects_embedding_status_check';
-- expect: projects_embedding_status_check | t

-- No row violates it.
SELECT embedding_status, count(*) FROM projects GROUP BY 1 ORDER BY 1;
-- expect: only the five legal values, in any mix
```

If the constraint add fails with a `violates check constraint` error on an
existing row, run the pre-flight query in §1 to find it. Do not coerce those rows
blindly — an unexpected value usually means a write path the code no longer
recognises, and that is worth reading before it is overwritten.