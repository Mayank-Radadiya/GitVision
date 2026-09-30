import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

/**
 * Creates context for all tRPC procedures
 * Integrates Clerk authentication and request data
 * opts is optional — present in the fetch adapter, absent in server-side
 * callers (server components, server actions). `auth()` is not optional and
 * is the only source of identity, which is why this context is usable from
 * server components but not from a background job: there is no request for
 * Clerk to read a session out of. See the `caller` docstring in server.tsx.
 */
export const createTRPCContext = cache(async (opts?: { req?: Request }) => {
  const { userId } = await auth();
  // Vercel and most proxies send x-request-id. Without one, every log line
  // from this request would be uncorrelatable, so make our own.
  const requestId =
    opts?.req?.headers.get("x-request-id") ?? crypto.randomUUID();

  return {
    req: opts?.req,
    userId,
    requestId,
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

export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Public procedure - no session required
 *
 * Every procedure in this app was `protectedProcedure` until the landing page
 * needed real numbers to show a signed-out visitor. There is no mechanism in
 * the router to make one of those reachable without a session: `proxy.ts`
 * runs `auth.protect()` on the whole `/api/trpc` prefix, and `httpBatchLink`
 * POSTs to `/api/trpc?batch=1&input=...`, so a single procedure cannot be
 * allowlisted by pathname. A public procedure is therefore reachable only
 * server-side, through the `caller` or `prefetch()` in `server.tsx` — which is
 * what `app/page.tsx` does for `getPublicStats`.
 *
 * Anything added here returns the same rows to a signed-out stranger that it
 * would return to a signed-in user. Keep it to aggregate counts and never to
 * anything keyed on `ownerId`.
 */
export const publicProcedure = t.procedure;
