# 0004 — `chats_user_id_updated_at_idx` and `project_files_project_id_language_idx`

Two composite btree indexes. No table, column, constraint or row changes — this
migration is `CREATE INDEX` only, so it is safe to run while the app is serving.

Audit refs: **L9**, **§10.3** (§16.25).

---

## 1. What each index is for

### `project_chats(user_id, updated_at)`

`chat.getAll` pages one user's chats by `updatedAt DESC` with a keyset cursor
(`src/features/chat/server/router/chat.ts:60-104`). The table already had
`chats_user_id_idx`, which matches *every* chat the user has and then sorts the
one page that is being asked for. Measured before the change on the dev
database:

```
 Limit  (cost=8.38..8.39 rows=1)  (actual time=1.289..1.290 rows=2.00)
   ->  Sort  (cost=8.17..8.18)  Sort Key: project_chats.updated_at DESC
         Sort Method: quicksort  Memory: 25kB
         ->  Index Scan using chats_user_id_idx on project_chats
```

The `Sort` node is the cost. With `updated_at` in the key, the planner walks the
index backwards and the sort disappears. Forced (`enable_seqscan=off`) after
the change:

```
 Limit  (cost=1.24..9.26 rows=1)  (actual time=1.771..1.774 rows=2.00)
   ->  Index Scan Backward using chats_user_id_updated_at_idx on project_chats
         Index Cond: ((user_id)::text = ...)
```

No `Sort`, no `HashAggregate` — the keyset cursor's range condition rides the
same index. At 200k chats / 50 users on a scratch table the same query is
0.124 ms over 11 buffers.

### `project_files(project_id, language)`

`getProjectContext` runs `SELECT DISTINCT language … WHERE project_id = ?`
(`src/features/rag/services/vector-search.ts:91`). This is the only query in
the repo that reads `project_files.language`, and it had no index at all — on
the dev database it was a `Seq Scan on project_files` with
`Rows Removed by Filter: 111`.

**Deviation from the ticket, deliberately.** The task says "add an index on
`project_files.language`". A bare index on `language` would not help: the query
predicates on `project_id`, so Postgres would have to read the whole language
index and re-check the project on every row. `project_id` leads and `language`
follows, which matches the only predicate in the query and lets the `DISTINCT`
be answered by an ordered index-only scan. Measured on a scratch table of
200k files for one project:

| | execution | buffers | heap fetches |
|---|---|---|---|
| seq scan + hash aggregate | 51.8 ms | 1274 | 200 000 |
| index-only scan on the composite | 33.7 ms | 179 | 0 |

(That comparison needs a `VACUUM` first. On a table that was never vacuumed the
visibility map is empty, the index-only scan degrades to 200 000 heap fetches,
and it comes out *slower* than the seq scan. Do not measure this one on a
freshly-populated table.)

---

## 2. Honest statement of what is measurable today

Both indexes are correct for the query, but the dev database is too small for
the planner to pick either one on its own. After the change, with no
`enable_seqscan` override:

* `project_chats` — still a seq scan plus a sort, because there are 2 rows.
* `project_files` — still a seq scan, because there are 111 rows.

A plan that still says `Seq Scan on project_chats` is therefore **not** a sign
this migration failed. `chats_user_id_idx` and
`project_files_project_id_idx` are deliberately left in place: a predicate on
`user_id` or `project_id` alone still uses them, and dropping a working index
to avoid one unused one is a net loss.

---

## 3. Build cost and lock behaviour

Two `CREATE INDEX` statements, each taking a `SHARE` lock on its table, which
blocks writes but not reads. Both tables are append-heavy on the write side
(`project_chats` on every new chat, `project_files` once per file at ingestion),
so the build will block those writes for its duration.

Sizing before applying anything larger:

```sql
SELECT relname, pg_size_pretty(pg_relation_size(c.oid)) AS heap,
       pg_size_pretty(pg_indexes_size(c.oid)) AS indexes
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE relname IN ('project_chats', 'project_files');
```

Roughly one third more index bytes than the heap for a two-column btree of
narrow values. If a future table grows large enough that a blocking build is not
acceptable, the statements need `CREATE INDEX CONCURRENTLY`, which **cannot run
inside the transaction that drizzle-kit wraps a migration in** — it would have
to become a manual, out-of-band step, and the entry here would be deleted from
`meta/_journal.json` so `db:push` does not try to replay it.

---

## 4. Does an equivalent index already exist under another name?

Checked before writing any of this. `pg_indexes` on the dev database, and the
schema callbacks in `db/schema.ts`:

| table | existing indexes |
|---|---|
| `project_chats` | `chats_project_id_idx`, `chats_user_id_idx`, `chats_type_idx` |
| `project_files` | `project_files_project_id_idx`, `project_files_hash_idx`, `project_files_project_id_file_name_unique` |

No collision on either name, and none of these is a prefix of the two new
composites. `0000_absent_moonstone.sql` was also grepped for both names — absent.

---

## 5. The write cost of keeping them

`project_chats` gains two more index entries per insert; `project_files` gains
two per ingested file. Ingestion already writes a row plus a full-text-search
document and one embedding per file, so two narrow btree entries are noise next
to that. The columns are `text`/`uuid` on one side and a `timestamp` and a
`varchar(50)` on the other — all fixed-width-ish, so the entries are small.

`updated_at` is a mutable column, so a chat rename or a touch repopulates the
new index's second key. That is why it is the *trailing* key: only rows the
user_id predicate already selected need to move, not the table.

---

## 6. Post-apply verification

```sql
-- both exist
SELECT indexname, indexdef FROM pg_indexes
 WHERE indexname IN ('chats_user_id_updated_at_idx',
                     'project_files_project_id_language_idx');
-- expect 2 rows, in that column order

-- nothing invalid was left behind
SELECT count(*) FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
 WHERE NOT i.indisvalid;

-- the chat page no longer sorts (the whole point)
EXPLAIN SELECT id FROM project_chats
 WHERE user_id = '<uuid>' ORDER BY updated_at DESC LIMIT 20;
-- no Sort node once the table is big enough for the planner to prefer the index
```

The repository's own assertion lives in
`src/__tests__/integration/credits-check-and-indexes.test.ts`, which checks both
that the indexes exist and that their **column order** is right — an index on the
wrong columns applies cleanly and still does nothing, so the name alone is not
evidence.
