import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { creditTransactions, usersTable } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "../../../../lib/trpc/init";

/**
 * The literal the caller must type to arm account deletion. A constant rather
 * than an inline literal so the dialog text and the validator cannot drift.
 *
 * Exported alongside the two schemas below because they are the whole security
 * surface of the delete path, and a guard nobody can test is a guard that rots.
 */
export const DELETE_CONFIRMATION = "delete my account" as const;

export const themePreferenceInput = z.enum(["light", "dark", "system"]);

export const deleteAccountInput = z.object({
  confirmation: z.literal(DELETE_CONFIRMATION),
});

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

  /**
   * The preferences the account carries between devices.
   *
   * Falls back to `dark` — the value the root ThemeProvider already used before
   * this column existed — when the row is missing. A missing row means the
   * Clerk `user.created` webhook has not landed yet, which is a transient state
   * and not a reason to fail the settings page.
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ themePreference: usersTable.themePreference })
      .from(usersTable)
      .where(eq(usersTable.id, ctx.userId))
      .limit(1);

    return { themePreference: rows[0]?.themePreference ?? "dark" };
  }),

  /**
   * Persists the theme choice so it follows the user to another browser.
   *
   * The local copy is next-themes' job; this column is the cross-device one. The
   * enum is re-validated here rather than trusted from the column type, because
   * the client controls the payload and the column carries no SQL check.
   */
  setThemePreference: protectedProcedure
    .input(z.object({ theme: themePreferenceInput }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(usersTable)
        .set({ themePreference: input.theme, updatedAt: new Date() })
        .where(eq(usersTable.id, ctx.userId));

      return { theme: input.theme };
    }),

  /**
   * Self-serve account deletion.
   *
   * Order matters and is the security story: revoke the session first so the
   * Clerk token stops working even if the delete below fails, then delete the
   * Clerk user, then delete the database row. Child rows (projects, project
   * files, code embeddings, credit transactions) go with it through
   * `onDelete: "cascade"` — verified in `db/schema.ts` — so there is no window
   * where a partial delete leaves orphans behind.
   *
   * The final delete is a finisher, not the mechanism: `user.deleted` already
   * deletes the row in `app/api/webhooks/clerk/route.ts`. When the webhook has
   * already run, deleting an absent row is a no-op, and when it has not, this
   * closes the gap.
   *
   * `z.literal` is the only gate that matters. It rejects anything but the exact
   * phrase in a single parse, before any side effect runs, so a near-miss never
   * reaches Clerk. The dialog's disabled button is a second, cosmetic check.
   */
  deleteAccount: protectedProcedure
    .input(deleteAccountInput)
    .mutation(async ({ ctx }) => {
      // The context deliberately carries only `userId`; the session id has to be
      // read from the request, and `cache()` dedupes it against the context build.
      const { sessionId } = await auth();
      if (!sessionId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active session to revoke.",
        });
      }

      const client = await clerkClient();

      await client.sessions.revokeSession(sessionId);
      await client.users.deleteUser(ctx.userId);
      await db.delete(usersTable).where(eq(usersTable.id, ctx.userId));

      return { deleted: true as const };
    }),
});
