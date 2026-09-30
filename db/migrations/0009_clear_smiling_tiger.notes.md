# 0009 — `credit_transactions.ref_id`

Two statements: add a nullable column, build a unique index on it. No row is
rewritten and no existing row is touched.

Audit refs: **F-04**, and §5 of `0008_clever_taskmaster.notes.md`, which
records that the `refId` column was deliberately deferred there — *"It arrives
with the claim flow."* This is that arrival.

---

## 1. What it is for

The 24-hour credit claim. `credits.claim` grants a user a fixed top-up, and
without a key on the ledger the grant is a plain `UPDATE`, so it can be applied
twice: two concurrent clicks, a double-submit, or an Inngest retry landing a
second copy of the same daily run.

`ref_id` is the idempotency key those paths agree on. `claimCredits` inserts a
row carrying `ref_id = claim:<user_id>:<utc_date>` inside the same
data-modifying CTE that moves the balance, with `ON CONFLICT (ref_id) DO
NOTHING`. A second attempt finds the row the first one wrote, the `INSERT`
returns nothing, the `UPDATE` that reads from it matches zero rows, and the
function reports "nothing happened" instead of a second grant. One statement, no
transaction, no read-then-write window.

The daily cron uses the same mechanism with a prefix instead of a suffix,
`daily:<utc_date>:<user_id>`, so one run of the sweep is idempotent across the
whole table.

## 2. The two options that were rejected

**A NOT NULL column.** Rejected: it breaks two real callers. Every `spendCredits`
row records a charge and has no external reference to record — `projectService`
and the chat route call it with a cost and a reason, nothing else. And the 42
rows that exist today predate the column. A NOT NULL unique column would reject
all of them, including retroactively. Postgres treats NULLs as distinct inside a
unique index, so making the column nullable constrains exactly the rows that
supply a key and leaves the rest free — the constraint is opt-in per row without
being opt-in per table.

**A separate `credit_claims` table.** Rejected: it would duplicate the columns
`credit_transactions` already has (`user_id`, `delta`, `reason`, `created_at`,
`balance_after`) and then need a join or a trigger to keep `sum(delta)` equal to
the balance. The claim is a credit movement, it belongs in the ledger, and
putting it there is what makes the daily-grant history in F-17's settings page
show a claim as one of its rows rather than as a gap.

## 3. Index rationale

`credit_transactions_ref_id_idx` is a unique index rather than a `UNIQUE`
table constraint. The two are equivalent to Postgres for enforcement, but a
constraint is tied to the table while a named index can be dropped, rebuilt, or
made concurrent — the property that matters the first time this has to be
rebuilt on a table that is no longer empty.

It is not paired with a second index for reading. The claim's rolling 24-hour
check is `WHERE user_id = $1 AND reason = 'claim' AND created_at > now() - 24h`,
and the existing composite `(user_id, created_at, id)` already serves it:
`user_id` is the leading column, `created_at` is the range bound, and `reason`
filters only the handful of rows that range returns. This index is for the write
side — one probe per grant, to reject a replayed key.

Both indexes are ascending, including this one. The uniqueness argument does not
care about direction, and keeping the pair consistent is what lets a later
review reason about either one without re-deriving its scan behaviour.

## 4. Lock behaviour and build cost

`ALTER TABLE ... ADD COLUMN` with no `DEFAULT` takes `ACCESS EXCLUSIVE` on
`credit_transactions` and does **not** rewrite the table: Postgres 11 and later
record a missing value in the tuple's null bitmap, so the operation is a catalog
update plus a short exclusive lock. The explicit no-`DEFAULT` is what buys that
— a column with a constant default is rewritten so the value is physically
present, and a volatile default additionally takes a write lock on the table.

`CREATE UNIQUE INDEX` (not `CONCURRENTLY`) holds a `SHARE` lock against writers
for the duration of the build. At this table's size that is milliseconds. If
`credit_transactions` ever grows enough for the lock to matter, the fix is
`CREATE UNIQUE INDEX CONCURRENTLY` in its own migration — it cannot run inside
the transaction drizzle wraps, which is the only reason it is not used here.

Net cost against other tables: none. This migration touches one table, and it
takes the strongest lock on it for two short statements.

## 5. Naming deviations

None. The column is `ref_id` and the index is
`credit_transactions_ref_id_idx`, which is what the drizzle schema declares.

Note for readers comparing against 0008's §5: that section said `refId` was
deferred because *"its stated purpose — making `refundCredits` idempotent under
retry — has no consumer yet."* The consumer that arrived is the claim flow, not
the refund. `refundCredits` is still a plain alias for `grantCredits` and still
carries no key, because the chat route's module-local `refunded` latch remains
its retry guard. `spendCredits`, `grantCredits`, and `refundCredits` all accept
an optional `refId` and all three ignore it when it is not supplied; only the
claim and the cron pass one.

## 6. Verification

```sql
-- the column exists and is nullable
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'credit_transactions' AND column_name = 'ref_id';
-- expect: ref_id | character varying | YES

-- both indexes exist
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'credit_transactions' ORDER BY indexname;
-- expect: credit_transactions_ref_id_idx (UNIQUE) and
--         credit_transactions_user_id_created_at_id_idx

-- no pre-existing row acquired a key, and none can collide
SELECT count(*) AS keyed FROM credit_transactions WHERE ref_id IS NOT NULL;
-- expect: 0  -- every row predates this migration

-- the uniqueness the claim depends on, proven by the database and not by a comment
BEGIN;
INSERT INTO credit_transactions (user_id, delta, reason, balance_after, ref_id)
SELECT id, 50, 'claim', credits + 50, 'claim:' || id || '::probe'
  FROM users WHERE credits > 0 LIMIT 1
RETURNING ref_id;
-- expect: one row; re-run the identical INSERT
INSERT INTO credit_transactions (user_id, delta, reason, balance_after, ref_id)
SELECT id, 50, 'claim', credits + 50, 'claim:' || id || '::probe'
  FROM users WHERE credits > 0 LIMIT 1;
-- expect: INSERT 0 0  -- ON CONFLICT has something to reject it with
ROLLBACK;

-- the rolling 24h check is index-supported, not a sequential scan
EXPLAIN (COSTS OFF)
SELECT max(created_at) FROM credit_transactions
 WHERE user_id = '<user>' AND reason = 'claim';
-- expect: Index Scan using credit_transactions_user_id_created_at_id_idx
```

Per the Phase Rule for F-04, no test suite and no build were run, so the
statements above have not been executed against a live database; they are the
checks to run when one is available. `bunx tsc --noEmit` is the only
verification performed for this change.
