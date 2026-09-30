# 0011 — `projects.last_synced_at`

One `ADD COLUMN`. No row is updated and no backfill is run.

Audit ref: **F-14**, §5.14 of `task.md` and §2.3 rows 13 and 20 —
*"No re-sync — `delete` is the only project mutation"* and *"Shared single
`GITHUB_TOKEN` = one 5,000/hr pool"*.

---

## 1. What it is for

`delete` was the only mutation a project had. Once a repository was indexed it
was frozen at that instant: every commit pushed afterwards was invisible unless
the user deleted the project and spent credits recreating it. There was no way
to ask "what changed since I last looked", which is the one question a code
search product has to answer.

This column is the bookkeeping half of the fix. The re-sync itself lives in
`src/lib/github/services/resync.ts` and the `resync-project` Inngest function;
this records *when that last succeeded*, which three separate pieces of logic
need:

- **The staleness cron** (`stale-project-resync`) uses it to find projects that
  have gone stale, instead of re-polling everything nightly.
- **The UI** uses it to tell the user when the index was last current, so "no
  results for my question" has an answer attached.
- **The re-sync function** uses its own unchangedness as the signal that it can
  skip the embedding step entirely.

## 2. Why it is nullable, and what null means

`timestamp` with no default, so every existing row is null.

Null means **never re-synced**, and every project that existed before this
migration is null for exactly that reason. That is the honest reading, and it is
the one the cron needs: the predicate is

```sql
last_synced_at IS NULL OR last_synced_at < now() - interval '30 days'
```

so pre-migration projects are picked up on their first eligible night, get
stamped, and then fall onto the 30-day cadence. A `defaultNow()` would instead
have claimed every one of them was synced at migration time, which is false and
would have delayed their first real sync by a full month.

## 3. Why `updatedAt` is not sufficient on its own

`projects.updated_at` already existed and already moves on real activity, so
using it alone was the smaller change. It is not enough, for one reason: it
cannot distinguish "the user did something" from "we finished syncing". Using
it alone would mean a nightly cron re-streams the tarball of every active
project, every night, forever — a daily full re-import with none of the
incremental benefit, against the shared GitHub pool that motivated the fix.

The two columns answer different questions and both are needed:

| Column | Question |
| --- | --- |
| `updatedAt` | Has anyone touched this project recently? (cron's *worth it* gate) |
| `lastSyncedAt` | Is the index current? (cron's *due* gate, and the UI's answer) |

## 4. Failure direction

The column is written in the function's Finalize step, after the file
reconciliation and the delta re-embedding have both completed. It is
deliberately **not** written when:

- a step throws and retries are exhausted, or
- the run bails because a full embedding run is already in flight.

So a failed re-sync leaves `lastSyncedAt` at its previous value and the project
is re-attempted on the next eligible night. The inverse — stamping on attempt
— would mark a failed run as success and the project would sit stale for a
month.

## 5. What is *not* here

No index on `last_synced_at`. The staleness cron reads it inside a predicate
that is already bounded by `updated_at > cutoff` and `LIMIT 20`, against a
`projects` table that is small by construction (one row per repository a user
has added). An index would be paid for on every insert and used by one nightly
query.

## 6. Rollback

`ALTER TABLE "projects" DROP COLUMN "last_synced_at";`

Nothing else depends on it. Dropping it removes the cron's ability to
distinguish stale from fresh, so the correct rollback is to also disable the
`stale-project-resync` function in `app/api/inngest/route.ts` — otherwise the
cron falls back to its null branch and re-polls every active project nightly.
