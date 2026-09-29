/**
 * ---------------------------------------------------------------------------
 * File: trpc/server.ts
 * Purpose:
 * This file sets up the TRPC server configuration used specifically on the
 * server side of a Next.js application. It ensures:
 *
 *  - The file cannot be imported by client components (`server-only`)
 *  - A stable QueryClient is created for React Query during each request
 *  - TRPC options are wired together using the app router, context, and query client
 *  - A server-side TRPC caller is created for server actions or RSC
 *
 * In short, this file creates the "server entry point" for TRPC.
 * All server-side TRPC calls flow through here.
 * ---------------------------------------------------------------------------
 */

import "server-only"; // Ensures this file is ONLY executed on the server and never bundled for the client

import {
  createTRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { cache } from "react";
import { makeQueryClient } from "./query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { appRouter } from "./routers/_app";
import { createTRPCContext } from "./init";

/**
 * getQueryClient
 * ----------------
 * Creates a stable React Query client for the duration of a single server request.
 *
 * Why `cache()`?
 *  - Prevents creating multiple QueryClient instances within the same request
 *  - Ensures consistent caching and avoids memory leaks
 *
 * This is required for running TRPC inside Server Components.
 */
export const getQueryClient = cache(makeQueryClient);

/**
 * trpc
 * -----
 * Creates a TRPC options proxy which binds together:
 *   - The TRPC router
 *   - The server context
 *   - The React Query client
 *
 * This object is used by TRPC's React Query integration in server-side environments.
 */
export const trpc = createTRPCOptionsProxy({
  ctx: () => createTRPCContext(),
  router: appRouter,
  queryClient: getQueryClient,
});

/**
 * caller
 * -------
 * Creates a server-side TRPC caller, so procedures can be awaited *directly*
 * from a server component or a server action -- no HTTP round-trip, same
 * type-checked inputs and the same procedures as the client.
 *
 *   const chat = await caller.chat.getById({ chatId });
 *
 * REQUIRES A LIVE CLERK REQUEST CONTEXT. `createTRPCContext` builds the
 * context from Clerk's `auth()`, which resolves the signed-in user out of
 * the incoming request. There is no ambient user to fall back on, so this
 * caller only works somewhere a request exists: a server component, a
 * server action, anything inside the App Router's request scope.
 *
 * It does NOT work in a background job. An Inngest function runs long
 * after the HTTP request that enqueued it has finished; there is no session
 * to read, `auth()` has nothing to resolve, and every `protectedProcedure`
 * fails. This docstring used to advertise background jobs, which was a trap
 * for anyone who believed it.
 *
 * For background work, call the service layer directly and pass the user
 * through explicitly -- which is what the Inngest functions already do
 * (`src/lib/inngest/functions.ts` imports `getRepositoryFiles`,
 * `syncIssuesAndComments` and `processFileForRag` rather than going through
 * tRPC). The job knows which user it is running for; that has to come from
 * the job's own payload, not from a request that no longer exists.
 *
 * Follow-up, not a promise: a job-safe caller would mean a `createTRPCContext`
 * that accepts an explicit identity instead of reading one from a request, and
 * a set of procedures that are deliberately safe to run without a session.
 * Neither exists today.
 */
export const caller = appRouter.createCaller(() => createTRPCContext());

/*
  Utility function to prefetch TRPC queries or infinite queries.
  This allows server components or layouts to warm up the React Query cache
  before hydration, improving load performance and reducing waterfalls.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();

  // Detect infinite queries by inspecting the query key metadata
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return queryClient.prefetchInfiniteQuery(queryOptions as any);
  }

  return queryClient.prefetchQuery(queryOptions);
}

/**
 * Wraps children in a React Query HydrationBoundary.
 * Used to restore prefetched server-side data on the client,
 * enabling seamless hydration without additional network requests.
 */

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // Provide dehydrated server state so React Query can hydrate on the client
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
