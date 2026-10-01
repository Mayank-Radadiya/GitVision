/**
 * Credit accounting.
 *
 * Single implementation of "move this user's balance by N" so every metered path
 * shares one atomic, concurrency-safe primitive. The previous copy lived inside
 * the chat route, which meant a second metered operation (commit AI summaries)
 * had no correct version to call and ended up unmetered.
 *
 * Two properties this module is responsible for, and both are structural rather
 * than a matter of care at the call sites:
 *
 * 1. **A balance can never go negative.** The affordability guard lives in the
 *    WHERE clause of the UPDATE, not in a prior SELECT, so two concurrent
 *    requests cannot both pass a check and then both spend — the loser's UPDATE
 *    simply matches zero rows.
 *
 * 2. **The ledger cannot drift from the balance.** Each mutation is a single
 *    data-modifying CTE: the `UPDATE` runs as a CTE, and the `INSERT` into
 *    `credit_transactions` selects from that CTE's `RETURNING` clause. If the
 *    UPDATE matched no rows the CTE is empty, so the INSERT writes nothing —
 *    the ledger row and the balance change are the same statement, and there is
 *    no window in which one happened without the other. This is why there is no
 *    "charge, then record" sequence anywhere below.
 *
 * That CTE is not a stylistic choice forced by tooling: `db.transaction()` is
 * unavailable on the neon-http driver (it throws outright), and `db.batch()`
 * *is* a real single-round-trip transaction but cannot branch. A zero-row
 * UPDATE is not an error, so a batched `UPDATE` + `INSERT` would write a ledger
 * row for a charge that never happened. One statement avoids the question.
 *
 * 3. **A grant that can be replayed is deduplicated by the database, not by the
 *    caller.** The `ON CONFLICT (ref_id) DO NOTHING` clauses below need the
 *    unique index migration `0009` creates; against a database without it they
 *    raise rather than silently granting twice, which is the intended failure
 *    direction, but it does mean `0009` has to be applied before this code is
 *    live. Passing `null` for `refId` can never conflict — Postgres treats
 *    NULLs as distinct — so an unkeyed movement is unaffected either way.
 *
 *    That clause alone does **not** make a keyed movement idempotent, and this
 *    is the part that is easy to get wrong. `ON CONFLICT` suppresses the
 *    conflicting *row*; it does not undo a sibling data-modifying CTE that has
 *    already run. In the shape below the `UPDATE` is one such CTE, so a replayed
 *    keyed movement would move the balance a second time, write only one ledger
 *    row, and report `null`. `replayGuard` is what makes the key real — see its
 *    own comment for the shape of the guarantee and its one remaining hole.
 *
 * 4. **A refund is issued at most once per charge, and that survives the
 *    process dying.** `openCharge` returns a handle that owns the once-only
 *    state and the refund's idempotency key together, because keeping those two
 *    facts apart from each other is what let three call sites grow three
 *    different compensation shapes — one of which latched in a request-scoped
 *    variable that a serverless eviction erases along with the request.
 */

import { db } from "@/db";
import { creditTransactions, type CreditReason } from "@/db/schema";
import { logger } from "@/src/lib/logger";
import { sql, type SQL } from "drizzle-orm";

/** Credits charged to create a project. */
export const PROJECT_CREATION_COST = 10;

/** Credits charged per chat turn. */
export const CHAT_TURN_COST = 1;

/** Credits charged per AI commit summary. */
export const COMMIT_SUMMARY_COST = 1;

/**
 * Credits a brand-new account starts with. Exported so the two places that
 * provision a user (the Clerk webhook, and the lazy provisioning in
 * `projectService`) cannot drift apart on the number.
 */
export const SIGNUP_CREDIT_GRANT = 100;

/**
 * The ceiling a free account's balance is topped up to.
 *
 * The sidebar renders `{credits} / 100`, so this is not an internal tuning
 * number — it is a value the UI already displays. A grant that could push a
 * balance past it would render as `145 / 100`.
 */
export const MAX_FREE_CREDITS = 100;

/** Credits one `credits.claim` grants. */
export const CLAIM_AMOUNT = 50;

/** Credits the daily cron grants to any account below the ceiling. */
export const DAILY_CREDIT_GRANT = 5;

/**
 * The row shape the CTEs below return. Drizzle's `db.execute` hands back the
 * driver result un-mapped, so the generic is what gives `rows[0]` a type.
 */
type BalanceRow = { balance_after: number };

/**
 * The clause that makes a keyed movement safe to replay, or nothing when the
 * movement carries no key.
 *
 * Needed because of how Postgres runs a statement with several data-modifying
 * CTEs: they all execute, and `ON CONFLICT DO NOTHING` on one of them skips only
 * the row that conflicted. With the `UPDATE` in a sibling CTE of the `INSERT`,
 * a replay would therefore move the balance again while writing no second ledger
 * row. Requiring that no row with this key exists yet makes the `UPDATE` match
 * zero rows on the replay, which empties the CTE and takes the `INSERT` with it
 * — so the replay costs nothing at all and reports `null`, which is what both
 * callers above document as "already applied".
 *
 * Why the `UPDATE` stays first rather than adopting `claimCredits`' insert-first
 * shape: the `UPDATE` is what takes the row lock, and it needs to take it before
 * the ledger insert decides anything. An insert-first shape computes
 * `balance_after` from the pre-lock snapshot, so two concurrent movements can
 * both read the same balance and the later `UPDATE` overwrites the earlier one's
 * increment — a lost update. Here the row is locked first and re-read, which is
 * the same reason the affordability guard below is in the `WHERE` clause.
 *
 * Remaining hole: two *simultaneous* first runs of one key share a snapshot, so
 * both can evaluate `NOT EXISTS` as true and both move the balance, with one
 * ledger row. That needs concurrent replays of a single charge — which happens
 * when a serverless instance is evicted mid-refund and a client retries against
 * a second instance inside the same few milliseconds. The sequential retry, which
 * is the ordinary case, is covered.
 */
function replayGuard(refId: string | null | undefined): SQL {
  if (refId == null) return sql.empty();
  return sql`AND NOT EXISTS (SELECT 1 FROM credit_transactions WHERE ref_id = ${refId})`;
}

/**
 * Atomically spend `cost` credits, recording the movement in the ledger.
 *
 * @param reason what the charge was for; becomes the row's `reason`.
 * @param refId optional idempotency key. A replayed movement carrying a key
 *   already in the ledger moves the balance not at all and returns null; omitting
 *   it leaves the movement unkeyed, which is correct for a charge that is issued
 *   once per call. See `replayGuard`.
 * @returns the remaining balance, or null when the user could not afford it (in
 *   which case nothing was charged and nothing was recorded) or when the key was
 *   already spent.
 */
export async function spendCredits(
  userId: string,
  cost: number,
  reason: CreditReason,
  refId?: string | null,
): Promise<number | null> {
  const result = await db.execute<BalanceRow>(sql`
    WITH bal AS (
      UPDATE users
         SET credits = users.credits - ${cost}, updated_at = now()
       WHERE users.id = ${userId} AND users.credits >= ${cost}
         ${replayGuard(refId)}
      RETURNING credits
    )
    INSERT INTO credit_transactions (user_id, delta, reason, balance_after, ref_id)
    SELECT ${userId}, ${-cost}, ${reason}, bal.credits, ${refId ?? null} FROM bal
    ON CONFLICT (ref_id) DO NOTHING
    RETURNING balance_after
  `);

  return result.rows[0]?.balance_after ?? null;
}

/**
 * Atomically add `amount` credits, recording the movement in the ledger.
 *
 * Used both for the signup grant and for refunds, which is why the reason is a
 * parameter: a refund of a project creation is still a `project_creation` row
 * with a positive delta, and the ledger should read that way.
 *
 * @param refId optional idempotency key; see `spendCredits`.
 * @returns the new balance, or null if the user no longer exists or the key was
 *   already spent.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  refId?: string | null,
): Promise<number | null> {
  const result = await db.execute<BalanceRow>(sql`
    WITH bal AS (
      UPDATE users
         SET credits = users.credits + ${amount}, updated_at = now()
       WHERE users.id = ${userId}
         ${replayGuard(refId)}
      RETURNING credits
    )
    INSERT INTO credit_transactions (user_id, delta, reason, balance_after, ref_id)
    SELECT ${userId}, ${amount}, ${reason}, bal.credits, ${refId ?? null} FROM bal
    ON CONFLICT (ref_id) DO NOTHING
    RETURNING balance_after
  `);

  return result.rows[0]?.balance_after ?? null;
}

/**
 * Return `cost` credits to a user whose work did not complete.
 *
 * The counterpart to `spendCredits`, for the case where the charge succeeded but
 * the thing being paid for did not happen — a model error, a timeout, the user
 * navigating away mid-stream.
 *
 * @param refId optional idempotency key; see `spendCredits`. `openCharge` derives
 *   one per charge and is what metered paths should call — a bare `refundCredits`
 *   can be issued twice for one charge unless the caller is trusted to remember.
 */
export async function refundCredits(
  userId: string,
  cost: number,
  reason: CreditReason,
  refId?: string | null,
): Promise<number | null> {
  return grantCredits(userId, cost, reason, refId);
}

/**
 * An open charge: `cost` credits have been deducted, and the work they paid for
 * has not reported success yet.
 *
 * Deliberately an object rather than a pair of bare calls. The two operations a
 * caller needs — "the work finished" and "the work failed" — must not both be
 * callable on the same charge, and the refund must not be able to throw. None of
 * that is expressible as two functions over `(userId, cost, reason)`; all of it is
 * one object with two methods, which is why this is the interface every metered
 * path uses instead of arranging the calls itself.
 */
export type Charge = {
  /**
   * Record that the work completed, so no refund can be issued for this charge
   * afterwards. Safe to call more than once.
   *
   * Settling is not optional bookkeeping: the chat stream can report completion
   * and *then* still report an abort, and a credit that is refunded after the
   * answer was delivered is free usage. Without this, a refund is the default and
   * the last signal to arrive wins.
   */
  settle(): void;

  /**
   * Return the charge because the work did not happen.
   *
   * Idempotent: the first call issues the refund and every later call returns
   * without a round-trip. Two independent guards, neither sufficient alone —
   *
   * 1. The handle's own state, which stops the common case (an abort reported
   *    through more than one channel) without re-querying the ledger.
   * 2. The refund's `ref_id`, fixed when the charge was opened. If the process
   *    dies between the charge and the refund, the in-process guard dies with it
   *    and a retry would credit the user twice; `ON CONFLICT (ref_id) DO NOTHING`
   *    in `grantCredits` collapses those retries onto one credit instead. Only
   *    the refund leg is keyed — keying the charge on the same id would make the
   *    refund collide with its own charge and never be issued at all.
   *
   * Never throws. A refund that fails has already lost the race it was
   * compensating for, and letting it reject would replace the real failure — a
   * provider outage, a dead worker — with a database error that says nothing
   * about what went wrong. The failure is logged instead.
   */
  refund(): Promise<void>;
};

/**
 * Charge `cost` credits for work that is about to happen, returning a handle for
 * settling or refunding it.
 *
 * This is the entry point for every metered path. Charging and compensating are
 * one interface rather than two because D-11 settled on the non-transactional
 * `neon-http` driver: every step after a charge needs a compensating branch, and
 * three call sites each writing their own shape is how they drifted into
 * disagreeing about whether a refund may throw.
 *
 * @returns the handle, or null when the user could not afford the charge — in
 *   which case nothing was deducted and there is nothing to refund. The caller
 *   decides what "cannot afford" means to its own protocol (a 402 from a route, a
 *   `FORBIDDEN` from a procedure); this module returns no HTTP and no tRPC.
 */
export async function openCharge(
  userId: string,
  cost: number,
  reason: CreditReason,
): Promise<Charge | null> {
  const balance = await spendCredits(userId, cost, reason);
  if (balance === null) return null;

  // Minted once per charge, not once per refund attempt, which is the whole
  // point: every attempt to refund this charge must carry the same key.
  const refundRefId = `${reason}:${crypto.randomUUID()}:refund`;
  let state: "open" | "settled" | "refunded" = "open";

  return {
    settle() {
      if (state === "open") state = "settled";
    },
    async refund() {
      if (state !== "open") return;
      state = "refunded";
      try {
        await refundCredits(userId, cost, reason, refundRefId);
      } catch (error) {
        logger.error(
          `[Credits] Refund of ${cost} (${reason}) failed; the charge stands`,
          error,
        );
      }
    },
  };
}

/**
 * Grant a user the 24-hour claim top-up.
 *
 * Two independent guards, and they are not redundant:
 *
 * 1. The `NOT EXISTS` enforces the *rolling* 24-hour window. It is what stops
 *    the common case — claiming at 23:00 and again two hours into the next UTC
 *    day, which is a different `ref_id` and so is not caught by the constraint
 *    below.
 * 2. `ON CONFLICT (ref_id)` is the *hard* guarantee. Two concurrent claims in
 *    the same window would both evaluate the `NOT EXISTS` against a snapshot
 *    that predates the winner's insert, so only the unique index can reject
 *    the loser.
 *
 * `refId` is a parameter rather than derived here so the caller controls the
 * key's shape, and so this function stays free of clock formatting. Callers
 * must derive it from the authenticated user and must never accept it from
 * client input — a caller that took a `ref_id` from the request would let the
 * requester vary it to claim repeatedly.
 *
 * The `amt` CTE exists to clamp the grant to `MAX_FREE_CREDITS`, because the
 * sidebar renders the balance against that ceiling and an unclamped claim
 * displays as `145 / 100`. It also folds the ceiling test into a single
 * predicate: a user already at the cap matches no row and is reported the same
 * way as a user who claimed too recently.
 *
 * @returns the new balance, or null when the claim was refused — already
 *   claimed within 24h, already at the ceiling, or no such user.
 */
export async function claimCredits(
  userId: string,
  refId: string,
): Promise<number | null> {
  const result = await db.execute<BalanceRow>(sql`
    WITH amt AS (
      SELECT LEAST(${CLAIM_AMOUNT}, ${MAX_FREE_CREDITS} - credits)::int AS g
        FROM users
       WHERE id = ${userId} AND credits < ${MAX_FREE_CREDITS}
    ), claimed AS (
      INSERT INTO credit_transactions (user_id, delta, reason, balance_after, ref_id)
      SELECT u.id, amt.g, 'claim', u.credits + amt.g, ${refId}
        FROM amt JOIN users u ON u.id = ${userId}
       WHERE NOT EXISTS (
         SELECT 1 FROM credit_transactions t
          WHERE t.user_id = ${userId}
            AND t.reason = 'claim'
            AND t.created_at > now() - interval '24 hours'
       )
      ON CONFLICT (ref_id) DO NOTHING
      RETURNING user_id, balance_after
    )
    UPDATE users
       SET credits = claimed.balance_after, updated_at = now()
      FROM claimed
     WHERE users.id = claimed.user_id
    RETURNING users.credits AS balance_after
  `);

  return result.rows[0]?.balance_after ?? null;
}

/** Row shape for the set-based grant below, which returns one row per user. */
type DailyGrantRow = { id: string };

/**
 * Grant `DAILY_CREDIT_GRANT` to every account below the ceiling, in one
 * statement. This is the body of the daily Inngest cron.
 *
 * @param refIdPrefix prepended to each user's id to form that row's key, e.g.
 *   `daily:2026-09-30:`. Because the date is part of the key, one run is
 *   idempotent across the whole table and an Inngest retry mid-run writes no
 *   second row for anyone.
 * @returns how many accounts were granted.
 *
 * Deliberately not a loop over `grantCredits`. That function is per-user and
 * carries no ceiling predicate, so reusing it would mean a query to find the
 * eligible users followed by one round-trip per account; a single statement is
 * both less code and one round-trip.
 *
 * Known ceiling: an account at or above `MAX_FREE_CREDITS` matches no row and
 * so gets no `ref_id` written for the day. If it spends down and the cron is
 * re-run the same day, it is granted then. That is the fill-to-cap behaviour,
 * not a leak, but it does mean "one run is idempotent" holds for accounts that
 * received a grant, not for every account.
 */
export async function grantDailyCredits(
  refIdPrefix: string,
): Promise<{ granted: number }> {
  const result = await db.execute<DailyGrantRow>(sql`
    WITH eligible AS (
      SELECT id, LEAST(${DAILY_CREDIT_GRANT}, ${MAX_FREE_CREDITS} - credits)::int AS g
        FROM users
       WHERE credits < ${MAX_FREE_CREDITS}
    ), claimed AS (
      INSERT INTO credit_transactions (user_id, delta, reason, balance_after, ref_id)
      SELECT e.id, e.g, 'daily_grant', u.credits + e.g, ${refIdPrefix} || e.id
        FROM eligible e JOIN users u ON u.id = e.id
      ON CONFLICT (ref_id) DO NOTHING
      RETURNING user_id, balance_after
    )
    UPDATE users
       SET credits = claimed.balance_after, updated_at = now()
      FROM claimed
     WHERE users.id = claimed.user_id
    RETURNING users.id
  `);

  return { granted: result.rows.length };
}
