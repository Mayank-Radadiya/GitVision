# 0010 — `projects.indexed_file_count` / `projects.total_file_count`

Two `ADD COLUMN` statements. No row is updated and no backfill is run.

Audit ref: **F-12**, §5.12 of `task.md` — *"The UI polls every 2s and parses
`Indexed N of M files` back out of the `embeddingError` string to render
progress."*

---

## 1. What it is for

The embedding pipeline could already say how far along it was, but only in
prose. `generateEmbeddings`'s Finalize step writes, for a repo that exceeds
the 500-file cap:

```
Indexed 500 of 1200 files — the repository exceeds the 500-file embedding
cap, so the remaining 700 files are not searchable.
```

That sentence was the only carrier of the two numbers. The UI read it back with
a regex (`indexing-status-badge.tsx`, `parseIndexedCounts`) and got them back
out as integers. So a column that exists to report progress was doing double
duty as a message bus, and the consumer had to understand the producer's
prose — punctuation, capitalization, and the word "files" included.

Two integer columns break that coupling. The pipeline writes
`total_file_count` once in the Prepare step and advances `indexed_file_count`
in every batch; the UI reads the columns directly. The prose stays, because it
is the right thing to show a human, and because deleting it would change
behaviour the failed-state UI copy and the e2e assertions depend on. Only the
*reading* of it goes away.

## 2. Why not derived from the existing columns

`code_embeddings` could have answered "how many files are indexed" with a
`count(DISTINCT file_path)`, and `project_files` could have answered "how many
are eligible" with a plain `count(*)`. Both are indexed on `project_id`, so
either is a fast query.

Rejected anyway, for the reason the whole task exists: the answer has to be
available on every read, and reading it means a query. The current client
already polls every 2 seconds; the SSE route this migration unblocks polls the
database on the server for the same number. Moving the query server-side would
have moved the load, not removed it. A denormalized counter on the row the
status is already stored on costs one integer write per 5-file batch, which is
already a step that writes `embedding_progress` anyway.

The counters are therefore a cache with an authoritative source, not a second
source of truth. `MAX_EMBEDDING_FILES` and the batch loop are what make them
recomputable if they ever drift.

## 3. Why these are not `embedding_progress`

`embedding_progress` (0–100) is a percentage and cannot be inverted into a
count: 50% of 1200 files is 600, 50% of 10 files is 5, and the UI needs the
counts themselves to render "indexed N of M". Keeping both means the percentage
stays a display convenience and the counts stay facts.

During a run the two are derived from the same loop, so they agree. At the end
they need not: Finalize overwrites `indexed_file_count` with the authoritative
`selectedFiles - errors.length` and clamps `embedding_progress` to 100, which
means a run where most files failed reports 100% alongside a small count. That
is intentional — the run *is* finished, and the count is the number that
distinguishes a clean finish from a broken one.

## 4. The name collision with `total_files`

`projects.total_files` already exists and is **not** this column. That one is
the file count GitHub reported for the repository at import time, populated
before any embedding happens and never updated afterwards. `total_file_count`
is the number of files the current embedding run actually considered, written
by the Prepare step every run.

They routinely disagree — that disagreement *is* the partial-index case, where
`indexed_file_count = 500` and `total_file_count = 1200` on a repo whose
`total_files` might read 1200 too but which is equally often 0, because the
repo had no detectable language breakdown at import time.

Three similar names is a genuine hazard and is recorded as a Finding against
F-12 rather than fixed here. A rename touches the dashboard card list
(`getAllProjects`, an explicit column projection) and lands more naturally
alongside F-14's re-index work, which has to reason about exactly this
distinction.

## 5. Lock behaviour and build cost

Unlike 0009, both columns carry a constant `DEFAULT 0`. That is deliberate —
`notNull()` in the drizzle schema generates the `NOT NULL`, and dropping the
default to save a rewrite would require the two statements to be split across
concurrent passes to be safe.

`ALTER TABLE ... ADD COLUMN ... DEFAULT <constant>` **does** rewrite the table
in Postgres 11 and earlier, and is a metadata-only operation in Postgres 11+
for non-volatile defaults. The cost is a brief `ACCESS EXCLUSIVE` lock against
`projects`, which is the smallest table in the schema and holds no long-lived
locks of its own.

Both statements are in one migration file separated by `--> statement-breakpoint`,
which is how drizzle wraps them in a single transaction. If a future `projects`
grows large enough for the lock to matter, the upgrade is the same two
statements replayed as a direct `ALTER` outside drizzle's transaction.

Net cost against other tables: none. One table, two columns, no rewrite of
data and no backfill — the `DEFAULT 0` is what every existing row reads back
as, and the pipeline overwrites both on the next run.

## 6. Verification

```sql
-- both columns exist, NOT NULL, defaulting to 0
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'projects'
   AND column_name IN ('indexed_file_count', 'total_file_count')
 ORDER BY column_name;
-- expect: indexed_file_count | integer | NO | 0
--         total_file_count   | integer | NO | 0

-- every pre-existing row reads back as a valid empty run
SELECT count(*) AS untouched
  FROM projects WHERE indexed_file_count = 0 AND total_file_count = 0;
-- expect: every row, no exceptions — nothing was backfilled

-- after a capped run the pair reproduces what the prose used to encode
SELECT embedding_status, indexed_file_count, total_file_count
  FROM projects WHERE embedding_status = 'partial' ORDER BY updated_at DESC LIMIT 1;
-- expect: partial | 500 | 1200
```

Per the Phase Rule for F-12, no test suite and no build were run against a live
database, so the statements above have not been executed. `bun run typecheck`,
`bun run lint` and `bun run test` are the verification actually performed.
