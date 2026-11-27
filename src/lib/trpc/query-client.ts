import {
  dehydrate,
  QueryClient,
  type DehydratedState,
} from "@tanstack/react-query";
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
 * Attempts a transient query gets before it is reported as failed.
 *
 * Three, matching the library default that was in force before `shouldRetry`
 * existed — the change here is *which* errors are worth attempting, not how
 * many.
 */
export const MAX_QUERY_RETRIES = 3;

/**
 * tRPC error codes that describe a permanent answer.
 *
 * Every one of these is the server saying "no", not "not yet": the row is gone,
 * the caller is not who they claim to be, the request was malformed. Asking
 * again produces the same response, so a retry spends three round trips and
 * ~7s of backoff to arrive at the answer the first attempt already had.
 *
 * `NOT_FOUND` is the one that actually hurt. The project page polls
 * `getDetails` while a project indexes, and deleting the project made that poll
 * answer 404 on a loop — each tick multiplied by the retry budget below.
 */
export const TERMINAL_ERROR_CODES = [
  "BAD_REQUEST",
  "FORBIDDEN",
  "METHOD_NOT_SUPPORTED",
  "NOT_FOUND",
  "PARSE_ERROR",
  "PRECONDITION_FAILED",
  "UNAUTHORIZED",
  "UNSUPPORTED_MEDIA_TYPE",
] as const;

export type TerminalErrorCode = (typeof TERMINAL_ERROR_CODES)[number];

/**
 * Reads the tRPC code off a client error, if it is one.
 *
 * `TRPCClientError.data` is `DefaultErrorData`, whose `code` is the string key.
 * Anything that is not a tRPC error — a `fetch` that never resolved, a thrown
 * string, a component that threw on render — has no code, and those are the
 * ones most worth retrying, so the answer is `undefined` rather than a guess.
 */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const data = (error as { data?: { code?: unknown } }).data;
  return typeof data?.code === "string" ? data.code : undefined;
}

/**
 * Retry transient failures; report a permanent answer immediately.
 *
 * Wired as the global `retry` for every query so the decision lives in one
 * readable place. Two divergences this corrects:
 *
 *  - The library default is `isServer() ? 0 : 3`, so a prefetch that the server
 *    resolved to 404 never retried while the browser re-issued the same query
 *    three more times. Both sides now agree.
 *  - `retry: 3` applies to `NOT_FOUND`, which is the one error where the answer
 *    cannot change.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const code = errorCode(error);
  if (code !== undefined && (TERMINAL_ERROR_CODES as readonly string[]).includes(code)) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

/**
 * A query is worth handing to the browser when it has an answer — or when the
 * answer was a refusal.
 *
 * React Query's own default admits `status === "success"` only. That silently
 * drops every errored key, which is the wrong trade for a prefetch that already
 * ran: `prefetchQuery` is `fetchQuery(...).then(noop).catch(noop)`, so a 404
 * resolved during SSR vanished instead of travelling, and the browser re-asked
 * a question the server had already answered.
 *
 * `pending` is still excluded — there is nothing to say about a query that has
 * not answered.
 */
export function shouldDehydrateQuery(query: {
  state: { status: string };
}): boolean {
  return query.state.status === "success" || query.state.status === "error";
}

/**
 * The plain form of an error that is safe to serialize.
 *
 * `name`, `message` and `data` is the whole contract: `data.code` is what the
 * UI branches on to tell a deleted project from a dropped connection, and
 * `data.httpStatus` is what a log reader needs. Nothing else on a `TRPCClientError`
 * is ours to keep — `cause` can hold an arbitrary graph, and `stack` is the
 * server's, not the browser's.
 */
interface RscSafeError {
  name: string;
  message: string;
  data?: unknown;
}

function toRscSafeError(error: unknown): RscSafeError {
  if (typeof error !== "object" || error === null) {
    return { name: "Error", message: String(error) };
  }
  const source = error as { name?: unknown; message?: unknown; data?: unknown };
  const safe: RscSafeError = {
    name: typeof source.name === "string" ? source.name : "Error",
    message:
      typeof source.message === "string"
        ? source.message
        : "Unknown error",
  };
  if (source.data !== undefined) safe.data = source.data;
  return safe;
}

/**
 * `dehydrate`, made safe to pass across the RSC boundary.
 *
 * `dehydrateQuery` runs `serializeData` over `state.data` and nothing else, so
 * `state.error` crosses as a live `TRPCClientError` instance. `HydrateClient` is
 * a server component handing the result to `HydrationBoundary` — a Client
 * Component — as a prop, and React Flight rejects anything that is not a plain
 * object in that position. Admitting errored queries without this scrub would
 * trade a wrong-but-rendering page for a 500.
 *
 * So the error is flattened, not dropped. The browser still learns that the
 * project is gone, and learns it in the same render instead of after a round
 * trip.
 */
export function dehydrateForRsc(client: QueryClient): DehydratedState {
  const state = dehydrate(client);
  return {
    ...state,
    // `state.error` is `null` on a query that succeeded, not `undefined` —
    // comparing against `undefined` alone would mint an error for every
    // successful query in the payload.
    queries: state.queries.map((query) =>
      query.state.error == null
        ? query
        : { ...query, state: { ...query.state, error: toRscSafeError(query.state.error) } },
    ),
  };
}

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
        retry: shouldRetry,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery,
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
