/**
 * A failed prefetch has to survive the trip to the browser.
 *
 * `prefetchQuery` is `fetchQuery(...).then(noop).catch(noop)`, so a 404 during
 * server prefetch is swallowed rather than thrown — and React Query's
 * `defaultShouldDehydrateQuery` only admits `status === "success"`, so the
 * errored key was dropped from the payload entirely. The browser then saw
 * `pending` for a question the server had already answered, re-issued it, and
 * paid the retry budget on the way to the same permanent 404.
 *
 * Admitting the error is only half of it. `dehydrateQuery` runs `serializeData`
 * over `state.data` and nothing else: `state.error` crosses as a live
 * `TRPCClientError` class instance, and `HydrateClient` is a server component
 * handing `dehydrate(...)` to a Client Component as a prop. React Flight
 * rejects non-plain objects in that position, so the naive fix would 500 the
 * page it was meant to fix. Hence the scrub, and these assertions.
 */

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  dehydrateForRsc,
  makeQueryClient,
} from "@/src/lib/trpc/query-client";

/**
 * A client holding one query that has already settled, reached the same way the
 * app reaches it: `prefetchQuery`, whose rejection is swallowed by design.
 * Building the state by hand would test a shape nothing in the app produces.
 */
async function clientWith(
  outcome: "success" | "error",
): Promise<QueryClient> {
  const client = makeQueryClient();
  // `prefetchQuery` is what the app's `prefetch()` helper calls: `retry` is
  // forced off and the rejection is `.catch(noop)`'d, so an error lands in the
  // cache and the call resolves either way.
  await client.prefetchQuery({
    queryKey: ["project", "getDetails", { projectId: "p1" }],
    queryFn: () =>
      outcome === "success"
        ? Promise.resolve({ projectId: "p1" })
        : Promise.reject(
            Object.assign(new Error("Project not found"), {
              name: "TRPCClientError",
              data: { code: "NOT_FOUND", httpStatus: 404 },
            }),
          ),
  });
  return client;
}

describe("dehydrated errors", () => {
  it("admits an errored query instead of dropping the key", async () => {
    const state = dehydrateForRsc(await clientWith("error"));
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0]?.state.status).toBe("error");
  });

  it("survives the RSC boundary as a plain object", async () => {
    const state = dehydrateForRsc(await clientWith("error"));
    const error = state.queries[0]?.state.error as unknown as Record<
      string,
      unknown
    >;
    expect(Object.getPrototypeOf(error)).toBe(Object.prototype);
    // React Flight throws on anything carrying a non-plain prototype or a
    // function-valued own property. Round-tripping is the cheapest honest
    // check that neither is present.
    expect(() => JSON.parse(JSON.stringify(state))).not.toThrow();
  });

  it("keeps the tRPC code, because the UI branches on it", async () => {
    const state = dehydrateForRsc(await clientWith("error"));
    const error = state.queries[0]?.state.error as unknown as {
      message: string;
      data: { code: string; httpStatus: number };
    };
    expect(error.message).toBe("Project not found");
    expect(error.data.code).toBe("NOT_FOUND");
    expect(error.data.httpStatus).toBe(404);
  });

  it("does not invent an error on a query that succeeded", async () => {
    const state = dehydrateForRsc(await clientWith("success"));
    expect(state.queries[0]?.state.status).toBe("success");
    // React Query parks a `null` here, not `undefined`. An earlier version of
    // the scrub compared against `undefined` alone and duly fabricated
    // `{ name: "Error", message: "null" }` for every successful query.
    expect(state.queries[0]?.state.error).toBeNull();
  });
});

describe("makeQueryClient", () => {
  it("wires the admission policy onto every query", () => {
    const should = makeQueryClient().getDefaultOptions().dehydrate
      ?.shouldDehydrateQuery;
    expect(typeof should).toBe("function");
    const decide = should as (q: { state: { status: string } }) => boolean;
    expect(decide({ state: { status: "success" } })).toBe(true);
    expect(decide({ state: { status: "error" } })).toBe(true);
    expect(decide({ state: { status: "pending" } })).toBe(false);
  });
});
