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
 * Creates a server-side TRPC caller.
 *
 * This enables you to call TRPC procedures *directly* from server actions,
 * background jobs, or inside React Server Components -- without needing HTTP.
 *
 * Example:
 *   const user = await caller.user.getById({ id: "123" });
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
