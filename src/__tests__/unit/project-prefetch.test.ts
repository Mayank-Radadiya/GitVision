import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `prefetchProject` runs on the server before `HydrateClient` dehydrates the
 * query client. If it does not return a promise the page dehydrates an empty
 * cache, and if the commits prefetch is built from plain `queryOptions` the
 * key can never match the `useInfiniteQuery` the client hook actually uses.
 */
const h = vi.hoisted(() => {
  const calls: { kind: "query" | "infinite"; input: unknown }[] = [];
  const settled: string[] = [];
  const proc = (name: string) => ({
    queryOptions: (input: unknown) => {
      calls.push({ kind: "query", input });
      return { queryKey: [["project", name], { type: "query", input }] };
    },
    infiniteQueryOptions: (input: unknown) => {
      calls.push({ kind: "infinite", input });
      return { queryKey: [["project", name], { type: "infinite", input }] };
    },
  });
  return { calls, settled, proc };
});

vi.mock("@/src/lib/trpc/server", () => ({
  trpc: {
    project: {
      getDetails: h.proc("getDetails"),
      getCommits: h.proc("getCommits"),
      getIssues: h.proc("getIssues"),
    },
  },
  prefetch: vi.fn(async (options: { queryKey: unknown[] }) => {
    const name = (options.queryKey[0] as string[])[1];
    await Promise.resolve();
    h.settled.push(name);
  }),
}));

import { prefetchProject } from "@/src/features/projects/server/prefetch";

describe("prefetchProject", () => {
  beforeEach(() => {
    h.calls.length = 0;
    h.settled.length = 0;
  });

  it("returns a promise so the caller can await the cache before dehydrating", async () => {
    const result: unknown = prefetchProject("p1");

    expect(typeof (result as Promise<unknown> | undefined)?.then).toBe("function");
    await result;
  });

  it("awaits every query", async () => {
    await prefetchProject("p1");

    expect(h.settled).toEqual([
      "getDetails",
      "getCommits",
      "getIssues",
      "getIssues",
    ]);
  });
});
