import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditTransactions } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "../../../../lib/trpc/init";

/**
 * The user's own account, as opposed to their projects.
 *
 * Separate from `projectRouter` on purpose: the credit ledger is keyed on
 * `userId` and has nothing to do with any project, and the settings page (F-17,
 * which depends on this task's ledger) reads account data, not project data.
 */
export const userRouter = createTRPCRouter({
  /**
   * The signed-in user's credit ledger, newest first.
   *
   * Offset paging rather than the keyset cursor the commit and issue reads use.
   * The ledger is append-only and scoped to one user with a fixed sort order, so
   * an offset cannot skip or repeat a row within a walk — a row inserted
   * mid-walk lands ahead of the window, not inside it. Keyset would buy nothing
   * here and cost the cursor encode/decode helpers; reach for it if the ledger
   * ever gains deletes or backdated rows.
   *
   * `nextOffset` is null on the last page, so a client stops without having to
   * request one extra page to discover the end.
   */
  getCreditHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const items = await db
        .select({
          id: creditTransactions.id,
          delta: creditTransactions.delta,
          reason: creditTransactions.reason,
          balanceAfter: creditTransactions.balanceAfter,
          createdAt: creditTransactions.createdAt,
        })
        .from(creditTransactions)
        // Scoped to the caller's own rows in the same statement as the sort, so
        // there is no page that could serve another account's spending history.
        .where(eq(creditTransactions.userId, ctx.userId))
        .orderBy(desc(creditTransactions.createdAt), desc(creditTransactions.id))
        .limit(input.limit)
        .offset(input.offset);

      return {
        items,
        nextOffset:
          items.length < input.limit ? null : input.offset + items.length,
      };
    }),
});
