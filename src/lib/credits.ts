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
 */

import { db } from "@/db";
import { creditTransactions, type CreditReason } from "@/db/schema";
import { sql } from "drizzle-orm";

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
 * Atomically spend `cost` credits, recording the movement in the ledger.
 *
 * @param reason what the charge was for; becomes the row's `reason`.
 * @param refId optional idempotency key. A replayed insert carrying a key
 *   already in the ledger writes no second row; omitting it leaves the movement
 *   unkeyed, which is correct for a charge that is issued once per call.
 * @returns the remaining balance, or null when the user could not afford it (in
 *   which case nothing was charged and nothing was recorded).
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
 * @param refId optional idempotency key; see `spendCredits`. The chat route
 *   does not pass one, because it guards its refund with a module-local latch
 *   instead — see FINDINGS in the F-04 report for what that leaves open.
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
