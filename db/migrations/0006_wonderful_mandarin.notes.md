# 0006 — `users_email_nullable`

Two statements on one column: drop the default, then drop `NOT NULL`. The
`unique` constraint is untouched.

Audit refs: **T-005**, decision **D-1** (`docs/DECISIONS.md` L31-77),
`gitvisionStrategy2.md` §12.1, §2.3 row 5, §4.7. Unblocked by **F-11**.

---

## 1. What it is for

`users.email` was `notNull().unique().default("example@gmail.com")`. Both
properties are wrong for the same reason: an OAuth-only Clerk user has no email
address at all, and the schema left the app no correct way to say so.

A shared default on a unique column is a collision generator. The first
email-less user was stored as `example@gmail.com`. The second one — a different
human, a different Clerk id, no email either — got the same literal and hit
`23505 duplicate key value violates unique constraint "users_email_unique"`.
There is no number of retries that fixes a value that is wrong by construction.

The webhook (`app/api/webhooks/clerk/route.ts`) also *skipped* any event whose
first email address was missing, so the common case did not even reach the
database: the user authenticated through Clerk, had no `users` row, and sat in
a permanently empty product with no error anywhere. The lazy-provisioning path
in `projectService.ts` had the mirror-image bug — it substituted `""` for a
missing address, which is a *different* invalid value that collides the same
way, just one row later.

`NULL` is the state the domain actually has, and it is the one value Postgres
exempts from uniqueness: in a btree index, `NULL`s are never equal to each
other, so a `unique` column admits any number of them. That is what makes
option C the only one of the three recorded in D-1 that works.

## 2. The two options that were rejected

- **A synthetic placeholder** (`user_<clerkId>@users.invalid`). It is unique per
  user, so it would technically avoid 23505 — but it writes a fabricated
  address into a column that other systems read, and it has to be rewritten the
  moment the real address arrives. A value the database believes is false is
  worse than a value it knows is missing.
- **422 on a missing address** (in the webhook, or via Clerk's
  `require_email` setting). This converts a database modelling problem into an
  authentication failure: users who legitimately signed in through an OAuth
  provider that does not release an address become unable to sign in at all, and
  Clerk retries the delivery against a user who can never satisfy it.

## 3. Existing rows are not rewritten

This migration changes the column's *definition*. It does not touch any row
that already holds the literal `example@gmail.com` — that string stays in the
data as a real, unique, occupied address.

That is deliberate. Those rows are not detectable placeholders: a genuine user
may have registered with that address. Sweeping them to `NULL` would erase real
data, and re-keying them to a synthetic value would be the rejected option A
applied retroactively. If those rows are later identified as bad (by matching
them against Clerk's user list — no row in this table currently records which
provisioning path created it), that is a separate, deliberate data migration
with its own pre-flight query.

## 4. Lock behaviour and build cost

Two `ALTER TABLE` statements, each taking `ACCESS EXCLUSIVE` on `users` for
the duration — brief, since neither rewrites the table. No index is built and no
data is rewritten: dropping `NOT NULL` and a default is a catalog-only change.

The lock is still total for its duration, so both statements want to be in the
same transaction — which is how drizzle-kit already runs them, per the
`--> statement-breakpoint` separator. `users` is one row per authenticated
account and is the smallest table in the schema.

## 5. Verification

```sql
-- the column is nullable, has no default, and is still unique
SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'users' AND column_name = 'email';
-- expect: is_nullable = 'YES', column_default = NULL

SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conname = 'users_email_unique';
-- expect: UNIQUE (email)  -- still present, deliberately not dropped

-- many email-less rows can coexist; the collision D-1 describes is gone
BEGIN;
INSERT INTO users (id, name) VALUES ('t-null-1', 'a'), ('t-null-2', 'b');
-- expect: INSERT 0 2
ROLLBACK;

-- and the constraint still fires for real duplicates
BEGIN;
INSERT INTO users (id, name, email)
  SELECT 't-dup', 'c', 'example@gmail.com' FROM users WHERE email IS NOT NULL LIMIT 1;
-- expect: ERROR 23505 duplicate key value violates unique constraint
ROLLBACK;
```

Per the Phase Rule for T-005, no test suite and no build were run. The
integration suite `src/__tests__/integration/clerk-webhook.test.ts` was read to
confirm the unwrapped upsert does not break it — all three of its fixtures
supply a non-empty `email_addresses[0]`, so none of them exercised the removed
`if (email)` branch — but it has not been executed.
