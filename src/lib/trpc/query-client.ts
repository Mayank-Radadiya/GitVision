import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Factory for creating QueryClient instances
 * Includes serialize/deserialize for superjson transformer compatibility
 * Used by both server (RSC prefetching) and optionally client
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds — prefetched data stays fresh during hydration
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
