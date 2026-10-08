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
      getInsights: h.proc("getInsights"),
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
      "getInsights",
    ]);
  });

  it("prefetches the insights aggregate at the window the client opens with", async () => {
    await prefetchProject("p1");

    // The overview hero charts from `getInsights`, and the client's
    // `useProjectInsights` defaults to a 30-day window. A prefetch at any other
    // window produces a different query key, so the page ships an empty cache
    // for the chart it is about to draw and pays for a second round trip.
    const insights = h.calls.filter((c) => {
      const input = c.input as { projectId?: string; days?: number };
      return input.projectId === "p1" && input.days !== undefined;
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].kind).toBe("query");
    expect((insights[0].input as { days: number }).days).toBe(30);
  });

  it("builds the commits prefetch as an infinite query so the key matches useInfiniteQuery", async () => {
    await prefetchProject("p1");

    const commits = h.calls.filter(
      (c) => (c.input as { limit?: number })?.limit !== undefined,
    );
    expect(commits).toHaveLength(1);
    expect(commits[0].kind).toBe("infinite");
  });
});
