/**
 * Credit accounting.
 *
 * Single implementation of "charge this user N credits" so every metered path
 * shares one atomic, concurrency-safe primitive. The previous copy lived inside
 * the chat route, which meant a second metered operation (commit AI summaries)
 * had no correct version to call and ended up unmetered.
 *
 * The guard lives in the WHERE clause rather than in a prior SELECT, so two
 * concurrent requests can never drive a balance negative — the loser's UPDATE
 * simply matches zero rows.
 */

import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

/** Credits charged to create a project. */
export const PROJECT_CREATION_COST = 10;

/** Credits charged per chat turn. */
export const CHAT_TURN_COST = 1;

/** Credits charged per AI commit summary. */
export const COMMIT_SUMMARY_COST = 1;

/**
 * Atomically spend `cost` credits.
 *
 * @returns the remaining balance, or null when the user could not afford it
 * (in which case nothing was charged).
 */
export async function spendCredits(
  userId: string,
  cost: number,
): Promise<number | null> {
  const rows = await db
    .update(usersTable)
    .set({
      credits: sql`${usersTable.credits} - ${cost}`,
      updatedAt: new Date(),
    })
    .where(and(eq(usersTable.id, userId), gte(usersTable.credits, cost)))
    .returning({ credits: usersTable.credits });

  return rows[0]?.credits ?? null;
}
