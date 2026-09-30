# 0012 — `projects.briefing`

> **Status: not executed.** This migration has been generated and reviewed but
> not applied to any database. The SQL below is what `drizzle-kit migrate` will
> run; the verification queries at the end are written to be pasted by hand once
> it has.

## 1. What it is for

```sql
ALTER TABLE "projects" ADD COLUMN "briefing" jsonb;
```

One nullable JSONB column on `projects` holding a plain-language briefing of the
repository, produced by Gemini at the end of the embedding pipeline and rendered
at the top of the project Overview tab.

The payload has a fixed shape, described by the `RepoBriefing` interface in
`db/schema.ts` and enforced at write time by `repoBriefingSchema` in
`src/features/rag/services/rag/briefing-generator.ts`:

| Field | Type | What it holds |
| --- | --- | --- |
| `summary` | `string` | 2–4 sentence paragraph on what the project is and does |
| `description` | `string` | One sentence, used as the card subtitle |
| `techStack` | `string[]` | 3–10 framework / runtime / library names |
| `keyComponents` | `{ name, role, paths }[]` | 3–6 load-bearing parts, most important first |
| `architecture` | `string` | How the parts fit together |

The column is nullable with **no default**. That is deliberate — see §3.

## 2. Why JSONB and not five columns

The briefing is a single artefact with a single writer and a single reader. It is
written once by the post-index step and read once by the Overview card. Nothing
queries it, sorts on it, filters a WHERE clause by it, or joins across it.

Five nullable columns would buy nothing that a `jsonb` column does not already
give, and would cost more on every future shape change: adding a sixth field to a
JSONB payload is a code edit, while adding a sixth column is another migration
with its own lock and its own snapshot.

JSONB also keeps the write atomic. A Drizzle `.set()` writes the whole object in
one statement, so a reader can never observe a half-written briefing — summary
without architecture, say. Five columns could be written in one statement too,
but every reader that needs more than one field has to know which ones exist.

### Why not JSON (`json` rather than `jsonb`)

`jsonb` parses and normalises on write: it detoats the JSON text, drops duplicate
keys, and stores keys in a canonical order. `json` stores the text verbatim.
Neither matters for reads here, because the payload is always read back through
Drizzle and re-serialised to the client — but `jsonb` is ~20–30% smaller on disk
because the duplicated whitespace and key text are not stored twice. That also
matches the three existing JSONB columns on this table (`languages`) and
elsewhere in the schema (`chat_messages.related_files`, `issues.ai_tags`), so
there is one type to reason about.

There is no index on this column, and none is planned. It is never used as a
lookup key, so an index would only add write cost to the column's single write.

## 3. Why nullable with no default, rather than `'{}'::jsonb`

An empty object would be indistinguishable from a failed generation. The Overview
card needs to tell three states apart, and `embeddingStatus` supplies the context
that makes `null` unambiguous:

| `briefing` | `embeddingStatus` | What the user sees |
| --- | --- | --- |
| `null` | `pending` / `processing` | "Briefing is being generated…" |
| `null` | `completed` / `partial` | "No briefing available" — generation ran and produced nothing |
| `null` | `failed` | Indexing failed; the card stays quiet |
| object | any | The briefing |

A default of `'{}'` collapses the first two rows into one and forces the card to
guess which of the two happened. Null pushes that decision into the UI, where the
`embeddingStatus` value is already loaded.

The generator itself is total: `generateRepoBriefing` returns `null` rather than
throwing on a missing API key, an empty file set, a quota error, a timeout, or a
malformed model response. So `null` genuinely does cover "tried and could not" —
it is not an unreachable state.

## 4. Why this is a separate migration

`0011_wet_whizzer.sql` is the F-14 re-sync work and is still uncommitted in this
working tree. Folding a `projects` column change into it would make the F-14
commit — when it is finally made — depend on a feature that has nothing to do
with re-syncing, and would leave `0011` mutating again after review.

`0012` is therefore its own file with its own snapshot, and it is the last
migration in the journal.

## 5. Lock behaviour and build cost

`ADD COLUMN` with no default is a catalog-only operation on PostgreSQL 11 and
later: the table is not rewritten, no row is touched, and the lock is held only
for the duration of the `ALTER TABLE` itself. No `ACCESS EXCLUSIVE` rewrite,
no `REWRITE` keyword, no full-table vacuum storm afterwards.

This matters here because `projects` is a hot write table — every import and
every re-sync updates rows. Even a fast catalog-only `ACCESS EXCLUSIVE` blocks
those writes briefly, so it is worth keeping this migration free of anything
that would force a rewrite. Adding `NOT NULL DEFAULT '{}'` *would* have forced a
rewrite under `VOLATILE` default evaluation, which is the specific outcome §3
avoids for reasons that also happen to be cheap.

## 6. Verification

Not run — see the status note at the top. To verify after applying:

```sql
-- Column exists, is nullable, has no default.
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'projects' AND column_name = 'briefing';
-- expect: briefing | jsonb | YES | NULL

-- Drizzle's snapshot agrees with the live table.
SELECT briefing FROM projects LIMIT 1;
-- expect: zero rows, or one row with NULL briefing — not an error either way

-- After a project finishes indexing, one row should be populated and its
-- keys should match RepoBriefing exactly.
SELECT id, project_name, jsonb_object_keys(briefing)
  FROM projects
 WHERE briefing IS NOT NULL
 LIMIT 20;
-- expect summary, description, techStack, keyComponents, architecture

-- Projects indexed but never briefed: should shrink to zero as the pipeline
-- catches up, and never be non-zero for long.
SELECT count(*) FROM projects
 WHERE embedding_status IN ('completed', 'partial') AND briefing IS NULL;
```

If the last query stays non-zero, `generateRepoBriefing` returned `null` for
those projects — check the application logs for `[Briefing]` lines, which carry
the reason (missing API key, zero files, quota, or a parse failure).