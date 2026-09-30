import { TRPCError } from "@trpc/server";
import { claimCredits } from "@/src/lib/credits";
import { createTRPCRouter, protectedProcedure } from "../../../../lib/trpc/init";

/**
 * The credit top-up the sidebar offers.
 *
 * Its own router rather than a procedure on `userRouter` because the brief
 * names the endpoint `credits.claim`, and tRPC takes the namespace from the
 * router key — a procedure on `userRouter` would surface as `user.claim`.
 */
export const creditsRouter = createTRPCRouter({
  /**
   * Claim the 24-hour credit top-up.
   *
   * No input schema: the only input is which user is asking, and that comes
   * from the session. Nothing a client sends can influence the grant.
   *
   * The 24-hour limit is enforced in `claimCredits` rather than here, because
   * the check and the grant have to be one statement — a limit read in a
   * separate query and then applied is a limit two concurrent claims both pass.
   *
   * `TOO_MANY_REQUESTS` because the message is user-facing: every mutation
   * caller in this codebase surfaces `error.message` verbatim in a toast.
   */
  claim: protectedProcedure.mutation(async ({ ctx }) => {
    // Derived from the session, never from the request: a `ref_id` a client
    // could vary would let it claim by varying it. The UTC date makes the key
    // stable for the whole day, so a double-click collides on the unique index.
    const refId = `claim:${ctx.userId}:${new Date().toISOString().slice(0, 10)}`;

    const balance = await claimCredits(ctx.userId, refId);

    if (balance === null) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "You've already claimed today, or your balance is already full. Come back in 24 hours.",
      });
    }

    return { balance };
  }),
});
