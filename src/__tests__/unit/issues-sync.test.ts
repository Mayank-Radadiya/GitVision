import { beforeEach, describe, expect, it, vi } from "vitest";

// Ordered log of every side effect the sync performs. The behaviour under test
// is *when* the destructive prune happens relative to the GitHub reads, so the
// fake db records order rather than just call counts.
let events: string[] = [];

// Drizzle table objects are Proxies that throw on unknown property access, so
// tables are identified by identity, never by sniffing a property off them.
const tableNames = vi.hoisted(() => new Map<object, string>());

vi.mock("@/db", async () => {
  const { issuesTable, issueCommentsTable } = await import("@/db/schema");
  tableNames.set(issuesTable, "issues");
  tableNames.set(issueCommentsTable, "issue_comments");

  const chain = (rows: () => unknown[]) => {
    let pending: { issueNumber?: number }[] = [];
    const builder: Record<string, unknown> = {};

    builder.values = (values: { issueNumber?: number }[]) => {
      pending = values;
      return builder;
    };
    for (const method of [
      "where",
      "onConflictDoUpdate",
      "set",
      "limit",
      "orderBy",
      "from",
      "select",
    ]) {
      builder[method] = () => builder;
    }

    const settle = (value: unknown[]) => ({
      then: (ok?: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
        Promise.resolve(value).then(ok, err),
      catch: (err: (e: unknown) => unknown) => Promise.resolve(value).catch(err),
      finally: (end?: () => unknown) => Promise.resolve(value).finally(end),
    });

    builder.returning = () => {
      const out = pending.map((row, i) => ({
        id: `id-${row.issueNumber ?? i}`,
        issueNumber: row.issueNumber,
      }));
      pending = [];
      return settle(out);
    };
    Object.assign(builder, settle([]));
    return builder;
  };

  return {
    db: {
      insert: (table: object) => {
        events.push(`insert:${tableNames.get(table) ?? "unknown"}`);
        return chain(() => []);
      },
      delete: (table: object) => {
        events.push(`delete:${tableNames.get(table) ?? "unknown"}`);
        return chain(() => []);
      },
      select: () => chain(() => []),
      update: () => chain(() => []),
    },
  };
});

/** How many more pages the fake GitHub has; drives both exhaustion and the cap. */
let pagesRemaining = 0;
/** Page number (counting down) that should blow up, to inject a mid-sync 500. */
let failOnPage: number | null = null;

const makePage = (nodeCount: number) => ({
  repository: {
    issues: {
      nodes: Array.from({ length: nodeCount }, (_, i) => ({
        number: i + 1,
        title: `issue ${i + 1}`,
        body: "",
        state: "OPEN",
        author: { login: "acme", avatarUrl: "a.png" },
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        closedAt: null,
        comments: { nodes: [] },
      })),
      pageInfo: { hasNextPage: pagesRemaining > 0, endCursor: "cursor" },
    },
    pullRequests: {
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
});

vi.mock("@/src/lib/github/client", () => ({
  octokit: {
    graphql: vi.fn(async () => {
      const page = pagesRemaining;
      events.push("graphql");
      if (page === failOnPage) {
        throw new Error("GitHub 500");
      }
      pagesRemaining = Math.max(0, pagesRemaining - 1);
      return makePage(2);
    }),
  },
}));

import { syncIssuesAndComments } from "@/src/lib/github/services/issues";

const URL_UNDER_TEST = "https://github.com/acme/widgets";
const PROJECT = "project-1";

const prunes = () => events.filter((e) => e === "delete:issues").length;

beforeEach(() => {
  events = [];
  failOnPage = null;
  pagesRemaining = 0;
});

describe("syncIssuesAndComments", () => {
  it("deletes nothing when GitHub fails mid-pull, so existing issues survive", async () => {
    // Two more pages to read; the second one returns a 500.
    pagesRemaining = 2;
    failOnPage = 1;

    await expect(
      syncIssuesAndComments(URL_UNDER_TEST, PROJECT),
    ).rejects.toThrow();

    // The old implementation deleted every issue for the project before its
    // first GitHub call, so this project would have been left with zero issues
    // and no way back.
    expect(events.filter((e) => e === "graphql").length).toBe(2);
    expect(prunes()).toBe(0);
    expect(events).not.toContain("insert:issues");
  });

  it("prunes only after the whole pull has succeeded", async () => {
    pagesRemaining = 0;

    const result = await syncIssuesAndComments(URL_UNDER_TEST, PROJECT);

    expect(result.truncated).toBe(false);
    expect(prunes()).toBe(1);
    expect(events.indexOf("delete:issues")).toBeGreaterThan(
      events.lastIndexOf("graphql"),
    );
  });

  it("reports truncated instead of silently stopping at the page cap", async () => {
    // Always more pages, so the cap rather than exhaustion ends the loop.
    pagesRemaining = Number.MAX_SAFE_INTEGER;

    const result = await syncIssuesAndComments(URL_UNDER_TEST, PROJECT);

    expect(result.truncated).toBe(true);
    // A capped pull never saw the whole set, so pruning on "not in this list"
    // would delete issues that were never looked at.
    expect(prunes()).toBe(0);
  });

  it("does not report truncated when GitHub is exhausted", async () => {
    pagesRemaining = 0;

    const result = await syncIssuesAndComments(URL_UNDER_TEST, PROJECT);

    expect(result.truncated).toBe(false);
    expect(result.issuesFetched).toBeGreaterThan(0);
  });
});
