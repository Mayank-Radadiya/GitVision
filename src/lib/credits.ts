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
 * The row shape the CTEs below return. Drizzle's `db.execute` hands back the
 * driver result un-mapped, so the generic is what gives `rows[0]` a type.
 */
type BalanceRow = { balance_after: number };

/**
 * Atomically spend `cost` credits, recording the movement in the ledger.
 *
 * @param reason what the charge was for; becomes the row's `reason`.
 * @returns the remaining balance, or null when the user could not afford it (in
 * which case nothing was charged and nothing was recorded).
 */
export async function spendCredits(
  userId: string,
  cost: number,
  reason: CreditReason,
): Promise<number | null> {
  const result = await db.execute<BalanceRow>(sql`
    WITH bal AS (
      UPDATE users
         SET credits = users.credits - ${cost}, updated_at = now()
       WHERE users.id = ${userId} AND users.credits >= ${cost}
      RETURNING credits
    )
    INSERT INTO credit_transactions (user_id, delta, reason, balance_after)
    SELECT ${userId}, ${-cost}, ${reason}, bal.credits FROM bal
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
 * @returns the new balance, or null if the user no longer exists.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
): Promise<number | null> {
  const result = await db.execute<BalanceRow>(sql`
    WITH bal AS (
      UPDATE users
         SET credits = users.credits + ${amount}, updated_at = now()
       WHERE users.id = ${userId}
      RETURNING credits
    )
    INSERT INTO credit_transactions (user_id, delta, reason, balance_after)
    SELECT ${userId}, ${amount}, ${reason}, bal.credits FROM bal
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
 */
export async function refundCredits(
  userId: string,
  cost: number,
  reason: CreditReason,
): Promise<number | null> {
  return grantCredits(userId, cost, reason);
}
