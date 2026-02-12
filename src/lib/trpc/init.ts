import { initTRPC, TRPCError } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { auth } from "@clerk/nextjs/server";

/**
 * Creates context for all tRPC procedures
 * Integrates Clerk authentication and request data
 */
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  const { userId } = await auth();

  return {
    req: opts.req,
    userId,
  };
};

type Context = Awaited<ReturnType<typeof createContext>>;

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
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

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

export const protectedProcedure = publicProcedure.use(isAuthed);
