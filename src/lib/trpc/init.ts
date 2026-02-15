import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

/**
 * Creates context for all tRPC procedures
 * Integrates Clerk authentication and request data
 * opts is optional — present in fetch adapter, absent in server-side callers
 */
export const createTRPCContext = cache(async (opts?: { req?: Request }) => {
  const { userId } = await auth();

  return {
    req: opts?.req,
    userId,
  };
});

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC with context type and transformers
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson, // Serialize Date, Map, Set automatically
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Hide internal errors in production
        message:
          process.env.NODE_ENV === "production" &&
          error.code === "INTERNAL_SERVER_ERROR"
            ? "An error occurred"
            : error.message,
      },
    };
  },
});

/**
 * Export reusable router and procedure builders
 */

export const middleware = t.middleware;

// Used to create routers (e.g., export const userRouter = createTRPCRouter({...}))
export const createTRPCRouter = t.router;

// Used to generate a server-side caller (e.g., for RSC or actions)
export const createCallerFactory = t.createCallerFactory;

// Base TRPC procedure (e.g., used to define queries, mutations)
export const baseProcedure = t.procedure;
/**
 * Protected procedure - requires Clerk authentication
 * Throws UNAUTHORIZED if user is not authenticated
 */
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // Type-safe! userId is guaranteed to exist
    },
  });
});

export const protectedProcedure = baseProcedure.use(isAuthed);
