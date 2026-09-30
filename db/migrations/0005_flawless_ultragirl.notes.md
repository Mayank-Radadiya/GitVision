# 0005 — `projects_owner_id_github_url_unique`

A single composite unique constraint. No table, column, index or row changes —
this migration is one `ALTER TABLE … ADD CONSTRAINT` statement, so it is safe to
run while the app is serving.

Audit refs: **F-25**, `gitvisionStrategy2.md` §5.25, §2.3 row 4.

---

## 1. What it is for

`project.create` charges **10 credits** per project
(`PROJECT_CREATION_COST`, `src/lib/credits`). `db/schema.ts` had no uniqueness
constraint of any kind on `projects`, so nothing stopped the same repository
being inserted twice for the same owner.

The failure mode is not a cosmetic duplicate row — it is a **double charge**. A
double-click, a retried mutation, or two tabs open at once all produce two
project rows and two 10-credit debits for one repository. Credits are a real
balance (`users.credits` is additionally protected by
`users_credits_non_negative`), so a silently double-billed user is a money bug,
not a data-usage bug.

The database is the only place that can settle this correctly. A client-side
"does it already exist?" check is advisory at best — it cannot close the window
between the check and the insert, which is exactly the window the double-submit
uses.

## 2. Why the application never caught it

Two independent reasons, both verified by reading the code:

1. **The error is masked before it is handled.**
   `src/lib/github/services/project.ts:188-210` catches everything from the
   `INSERT` and re-wraps it as `GitHubError` with `code: "PROJECT_CREATE_ERROR"`,
   keeping the Postgres SQLSTATE only as a substring of
   `details.originalError`. The tRPC layer therefore has no `code` to switch on
   and falls through to a generic
   `INTERNAL_SERVER_ERROR` — *"Failed to create project. Please check the
   repository URL and try again."* — which is actively misleading, because the
   URL is fine.

2. **Even a perfect check would not have prevented the double charge.**
   The `INSERT` happens *before* `spendCredits`
   (`projectService.ts:235` vs `:256`), so the two are not atomic with each
   other. Two concurrent requests can both pass any pre-insert existence check
   and both charge. Only a unique constraint closes that window.

`PROJECT_ALREADY_EXISTS` is now detected and re-thrown at the masking layer and
translated to a tRPC `CONFLICT` with the message *"This repository has already
been added to your account."*

## 3. `unique` constraint, not `uniqueIndex`

`db/schema.ts` uses the `unique(...)` constraint helper on every other table
(`project_files_project_id_file_name_unique`, `commits_commit_hash_project_id_unique`)
and declared no `uniqueIndex` anywhere. This follows that convention. The two
are not a behavioural difference: Postgres implements a `unique` constraint with
a backing btree index, so the same rows are rejected either way. The constraint
form is the better fit here because it also lets `ON CONFLICT ON CONSTRAINT`
target it by name.

## 4. Applying this will fail if duplicates already exist

**Read this before running the migration against a real database.**

`ADD CONSTRAINT … UNIQUE` builds the index while holding the lock, and it
aborts on the first duplicate it finds. Any `(owner_id, github_url)` pair that
duplicated *before* this migration — which is exactly what the bug allowed —
makes the statement fail and the whole migration roll back.

Check first:

```sql
SELECT owner_id, github_url, count(*)
  FROM projects
 GROUP BY owner_id, github_url
HAVING count(*) > 1;
```

If that returns rows, this migration cannot be applied as-is. Clearing it needs
a product decision, not a mechanical one: which duplicate row survives, and what
happens to the credits the duplicate was charged. Both were billed 10 credits
for one repository, so a plain `DELETE` leaves some accounts overcharged and the
count is no longer recoverable from the `projects` table alone. Resolve that
first — this is out of scope for F-25, which was scoped to the schema, the
migration and the error translation.

## 5. Lock behaviour and build cost

One statement, `ACCESS EXCLUSIVE` on `projects` for the duration of the index
build — it blocks both reads and writes, not just writes. `projects` is small
(one row per tracked repository, and only a handful of indexes already on the
table), so the build is short, but the lock is total. It cannot use
`CREATE UNIQUE INDEX CONCURRENTLY` because that is not a constraint operation and
also cannot run inside the transaction drizzle-kit wraps a migration in.

On a table that has grown large enough for this to matter, the options are a
`pg_repack`-style online rebuild or a maintenance window. At current size, that
is speculative.

## 6. Verification

```sql
-- the constraint exists
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conname = 'projects_owner_id_github_url_unique';
-- expect: UNIQUE ("owner_id", "github_url")

-- the duplicate-repo guard actually fires
BEGIN;
INSERT INTO projects (name, github_url, owner_id)
SELECT name, github_url, owner_id FROM projects LIMIT 1;
-- expect: ERROR 23505 duplicate key value violates unique constraint
ROLLBACK;
```

Per the Phase Rule for this task, no test suite or build was run, so the unit
tests under `src/__tests__/unit/` that exercise `createNewProject` are
unverified as still passing.

<dcp-message-id>m0033</dcp-message-id>