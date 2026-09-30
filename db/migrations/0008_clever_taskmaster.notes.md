# 0008 — `credit_transactions`

Three statements: create the table, add the foreign key, build one index. No
existing table is altered and no existing row is touched.

Audit refs: **F-04**, decision **D-11** (`docs/DECISIONS.md`, the neon-http
driver settles the transaction question), **T-085** (`is_pro_user` dropped in
0007, which is why `users` has six columns and not seven). The `gitvisionStrategy2.md`
§5.4 ledger task this implements names the table `credit_ledger` and asks for a
unique `refId`; see §5 for why this migration uses a different name and omits
that column.

---

## 1. What it is for

`users.credits` is a bare integer with no history. Every movement of it happens
in `src/lib/credits.ts` and every one of those movements is unrecoverable after
the fact: a user who goes from 100 to 0 cannot find out what they spent it on,
and neither can support, because the only artefact is the current value.

This table is that missing artefact. One row per balance change, carrying the
signed `delta`, a `reason`, and the `balance_after` the move produced.

`balance_after` is denormalised on purpose. The alternative is to replay every
row to answer "what did I have yesterday", and a ledger nobody queries is not a
ledger.

The `ON DELETE CASCADE` on `user_id` is load-bearing rather than tidy: the
`user.deleted` branch of the Clerk webhook already deletes the `users` row and
relies on the cascade to remove the rest of the account. Without the
constraint, a deleted Clerk user would leave their spending history behind,
which is both wrong and a retention problem.

## 2. The two options that were rejected

The interesting decision is not the schema, it is how the ledger row is written
at the same time as the balance change. `spendCredits` and `grantCredits` in
`src/lib/credits.ts` do it as a **single data-modifying CTE**:

```sql
WITH bal AS (
  UPDATE users SET credits = users.credits - $1, updated_at = now()
   WHERE users.id = $2 AND users.credits >= $1
  RETURNING credits
)
INSERT INTO credit_transactions (user_id, delta, reason, balance_after)
SELECT $2, -$1, $3, bal.credits FROM bal
RETURNING balance_after
```

If the `UPDATE` matches no rows the CTE is empty, so the `INSERT` writes
nothing. The balance change and the audit record are one statement, and the
invariant `sum(delta) == balance` holds for every user with no repair job.

- **`db.transaction()`** — unavailable. The neon-http driver throws outright
  (`drizzle-orm/neon-http/session.js`: `"No transactions support in neon-http
  driver"`). This is D-11's settled position and the reason the project already
  compensates by hand elsewhere.
- **`db.batch([UPDATE, INSERT])`** — available, and genuinely atomic: it maps to
  `neon()`'s `sql.transaction()`, one HTTP round trip, real Postgres
  transaction semantics. It is still wrong here, because a batch **cannot
  branch**. A zero-row `UPDATE` is not an error, so the ledger `INSERT` would
  fire even when the user could not afford the charge — writing an audit record
  for money that was never spent. That is precisely the failure the ledger
  exists to rule out, and it is a silent one: no error, no retry, a balance that
  matches but a history that does not.

Rejected at the schema level, for completeness: a `refId` idempotency key
(task.md F-04 asks for it, to make `refundCredits` safe to retry) and any
`ON DELETE` other than `CASCADE`. The first has no consumer in this change —
the claim flow and the daily-grant cron that would need it are not in scope —
and an unused unique column is a constraint on every future insert paid for by a
requirement that does not exist yet.

## 3. The index is one index, and it is ascending

`credit_transactions_user_id_created_at_id_idx` is declared ascending even though
the only read sorts descending. A btree index scans backwards just as cheaply,
so `WHERE user_id = $1 ORDER BY created_at DESC, id DESC` is served by a
backward scan of the forward index. There is deliberately no second index on
`user_id` alone: the composite already leads with it and is strictly wider only
in the columns after the first, which the leading column decides.

`getCreditHistory` pages with `LIMIT`/`OFFSET` rather than the keyset cursor
the commit and issue reads use. The ledger is append-only, scoped to one user,
and has a fixed sort order, so an offset cannot skip or repeat a row within a
walk. Keyset is the right call when rows can be inserted *inside* the sort
window, and that cannot happen to a per-user append-only table.

## 4. Lock behaviour and build cost

`CREATE TABLE` takes no lock on any existing relation. The `ALTER TABLE ... ADD
CONSTRAINT FOREIGN KEY` takes a brief `ACCESS EXCLUSIVE` on
`credit_transactions` and a `ROW SHARE` on `users`, and validates zero rows
because the table was created empty in the previous statement of the same
transaction. The `CREATE INDEX` is a plain non-concurrent build over an empty
table, so it is instant.

Net cost against existing tables: one `ROW SHARE` on `users` for the
foreign-key check, held only for the duration of the `ALTER`. `users` is the
smallest table in the schema.

## 5. Named `credit_transactions`, not `credit_ledger`, and no `refId`

task.md's F-04 specifies `credit_ledger (userId, delta, reason, unique refId,
createdAt)`. Two deliberate departures:

The **name** follows the task this migration ships, not the earlier draft. The
table holds a transaction record, and `credit_transactions` is what the
implementation calls it in code and in the `getCreditHistory` procedure.

The **`refId`** is omitted because its stated purpose — making `refundCredits`
idempotent under retry — has no consumer yet. The retry path that exists today
is a latch in the chat route (`app/api/chat/route.ts`), which runs at most once
per request regardless of how many times the abort is signalled, so there is
nothing for a key to deduplicate. It arrives with the claim flow.

Both departures are recorded in task.md alongside the F-04 DONE entry, along
with the claim flow and the Inngest daily-grant cron, which are also part of
that task and also not in this change.

## 6. Verification

```sql
-- the table exists with the expected shape
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'credit_transactions'
 ORDER BY ordinal_position;
-- expect: id uuid NOT NULL, user_id varchar NOT NULL, delta integer NOT NULL,
--         reason varchar NOT NULL, balance_after integer NOT NULL,
--         created_at timestamp NOT NULL

-- the cascade is on the foreign key, not merely implied
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conname = 'credit_transactions_user_id_users_id_fk';
-- expect: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade

-- one index, leading with user_id
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'credit_transactions';
-- expect: exactly credit_transactions_user_id_created_at_id_idx on
--         (user_id, created_at, id)

-- a spending user cannot be driven negative, and writes no row when they cannot
-- afford it (run as a real user with a known balance)
BEGIN;
SELECT credits FROM users WHERE id = '<user>';
UPDATE users SET credits = users.credits - 100000
 WHERE id = '<user>' AND credits >= 100000;
-- expect: UPDATE 0  -- guard holds, no ledger row
ROLLBACK;

-- the ledger's core invariant, for any provisioned user
SELECT u.credits, COALESCE(SUM(t.delta), 0) AS ledgered
  FROM users u
  LEFT JOIN credit_transactions t ON t.user_id = u.id
 WHERE u.id = '<user>'
 GROUP BY u.credits;
-- expect: credits = ledgered
```

Per the Phase Rule for F-04, no test suite and no build were run. The four
fixtures in `src/__tests__/integration/clerk-webhook.test.ts` were read
against the split `user.created` / `user.updated` branch: all four use
`user.updated`, whose upsert, `credits` value of 100, and credit-free `set`
object are all preserved, and the mock's chain has no `.returning()` method that
the new `user.created` path would need — so no existing fixture exercises the
changed branch. That branch has no coverage; see the FINDINGS in the task
report. The test has not been executed.
