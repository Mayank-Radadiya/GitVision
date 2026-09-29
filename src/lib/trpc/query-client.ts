import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

/**
 * How long prefetched data is trusted without a refetch.
 *
 * Data that crossed the RSC boundary is already on the client, so refetching it
 * immediately after hydration would throw that work away. Exported so the
 * handful of queries that want a different window can name theirs against this
 * one instead of restating the reasoning.
 */
export const HYDRATION_STALE_TIME = 30 * 1000;

/**
 * Factory for creating QueryClient instances
 * Includes serialize/deserialize for superjson transformer compatibility
 * Used by both server (RSC prefetching) and optionally client
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: HYDRATION_STALE_TIME,
      },
      dehydrate: {
        serializeData: superjson.serialize,
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
