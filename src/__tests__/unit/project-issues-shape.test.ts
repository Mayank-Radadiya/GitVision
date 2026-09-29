/**
 * T50 — `getProjectIssues` must stop pretending it is paginated.
 *
 * It took a `limit`, capped it at 100, ordered by `githubUpdatedAt DESC` and
 * returned whatever came back. A project with 300 issues could therefore never
 * show issue 101: there was no cursor to ask for the rest, and no `hasMore` to
 * tell the list view that the 100 rows it had were not all of them. The list
 * looked complete and was not.
 *
 * The fix is keyset paging on `(github_updated_at, id)` plus an over-fetch of
 * one row, so `hasMore` is measured rather than guessed. `id` is in the key
 * because `githubUpdatedAt` is not unique — many issues are synced in the same
 * second — and a timestamp-only key silently drops every row that ties.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

/** Issues the mocked lookup returns. */
let issueRows: unknown[] = [];
/** Projects the caller owns, per the mocked `projects` table. */
let projectRows: unknown[] = [];
/** Every `limit(n)` the mocked builder was asked for, in call order. */
let limits: number[] = [];

/**
 * The predicates each query was asked to apply, flattened to strings.
 *
 * The keyset predicate is the point of the change and the only way to see it
 * from a mocked builder is to capture what went into `where`. `and()`/`or()`
 * walk `queryChunks`, so a real condition stringifies with the column name and
 * bound parameter in it.
 */
let predicates: string[] = [];

/**
 * Flattens a Drizzle SQL condition to text.
 *
 * A condition is a tree of `queryChunks`: bound values carry `.value`, column
 * references carry `.name`. `String(condition)` would yield `[object Object]`
 * and the assertion would pass on nothing.
 */
function describeCondition(condition: unknown): string {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return String(condition);
  return chunks
    .map((chunk) => {
      const { value, name } = chunk as {
        value?: unknown;
        name?: string;
        queryChunks?: unknown[];
      };
      if (value !== undefined) return String(value);
      if (name !== undefined) return name;
      // `or()` and `and()` nest their operands as further SQL objects, so the
      // keyset predicate is not at the top level of the outer `where`.
      const nested = (chunk as { queryChunks?: unknown[] })?.queryChunks;
      if (Array.isArray(nested)) return describeCondition(chunk);
      return "";
    })
    .join(" ");
}

/** Chainable no-op query builder; `then` resolves to `rows`.
 *
 * `limit` is honoured — over-fetching by one is the mechanism `hasMore` is
 * derived from, and a mock that ignored it would make the assertion pass for a
 * service that never over-fetched.
 */
function chain(rows: unknown[] = []) {
  const builder: Record<string, unknown> = {
    capped: Number.POSITIVE_INFINITY,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(rows.slice(0, builder.capped as number) as unknown[]).then(
        resolve,
      ),
  };
  for (const method of [
    "select",
    "from",
    "orderBy",
    "leftJoin",
    "innerJoin",
    "set",
    "values",
    "returning",
    "insert",
    "update",
    "delete",
  ]) {
    builder[method] = () => builder;
  }
  builder.where = (...conditions: unknown[]) => {
    predicates.push(...conditions.map(describeCondition));
    return builder;
  };
  builder.limit = (n: number) => {
    limits.push(n);
    builder.capped = Math.min(builder.capped as number, n);
    return builder;
  };
  return builder;
}

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.projectTables) return chain(projectRows);
          if (table === schema.issuesTable) return chain(issueRows);
          return chain([]);
        },
      }),
    },
  };
});

vi.mock("@/src/lib/inngest/client", () => ({ inngest: { send: async () => {} } }));
vi.mock("@/src/lib/credits", () => ({
  spendCredits: async () => 0,
  PROJECT_CREATION_COST: 10,
  COMMIT_SUMMARY_COST: 1,
}));
vi.mock("@/src/lib/github", () => ({
  createNewProject: async () => ({}),
  getAiSummaryOfCommit: async () => "",
  syncIssuesAndComments: async () => ({ issues: 0, pullRequests: 0 }),
}));

import { createProjectService } from "@/src/features/dashboard/server/router/services/projectService";

const service = createProjectService();

beforeEach(() => {
  issueRows = [];
  projectRows = [{ ownerId: "user_1" }];
  limits = [];
  predicates = [];
});

/** `count` issues, newest first, one hour apart. */
function issuesOf(count: number) {
  const base = Date.parse("2026-03-01T00:00:00.000Z");
  return Array.from({ length: count }, (_, i) => ({
    id: `i${String(i).padStart(3, "0")}`,
    title: `Issue ${i}`,
    issueNumber: i,
    isPullRequest: false,
    state: "open",
    authorLogin: "octocat",
    authorAvatar: null,
    githubUpdatedAt: new Date(base - i * 3_600_000),
    githubCreatedAt: new Date(base - i * 3_600_000),
    aiComplexity: null,
    aiTags: null,
    aiSummary: null,
  }));
}

describe("getProjectIssues shape", () => {
  it("over-fetches by one so hasMore is measured", async () => {
    issueRows = issuesOf(3);

    await service.getProjectIssues(PROJECT_ID, "user_1", false, 2);

    expect(limits).toEqual([1, 3]);
  });

  it("returns items with hasMore and nextCursor", async () => {
    issueRows = issuesOf(3);

    const page = await service.getProjectIssues(PROJECT_ID, "user_1", false, 2);

    expect(page.items.map((i) => i.id)).toEqual(["i000", "i001"]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toContain("i001");
  });

  it("reports no more rows when the page is not full", async () => {
    issueRows = issuesOf(2);

    const page = await service.getProjectIssues(PROJECT_ID, "user_1", false, 50);

    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("keeps capping the caller's limit at 100, plus the overflow row", async () => {
    issueRows = issuesOf(120);

    const page = await service.getProjectIssues(PROJECT_ID, "user_1", false, 500);

    expect(page.items).toHaveLength(100);
    expect(page.hasMore).toBe(true);
    // The cap applies to what the caller receives, so the over-fetch is on top
    // of it — a 101st row is fetched and then dropped, not returned.
    expect(limits).toEqual([1, 101]);
  });

  it("puts the cursor in the same statement as the ownership predicate", async () => {
    issueRows = issuesOf(5);

    await service.getProjectIssues(
      PROJECT_ID,
      "user_1",
      false,
      50,
      "2026-03-01T00:00:00.000Z|i002",
    );

    // One `where` on the issues query carries the project, the issue/PR flag and
    // the cursor together. A second query for the cursor's page would be an
    // existence oracle for other tenants' issue ids.
    const issuesQuery = predicates[predicates.length - 1];
    expect(issuesQuery).toMatch(/github_updated_at/);
    expect(issuesQuery).toMatch(/id/);
    expect(predicates).toHaveLength(2);
  });

  it("reaches the issues past the first 100 by following the cursor", async () => {
    const all = issuesOf(120);
    issueRows = all;

    const seen: string[] = [];
    // Same contract as the comment test: the mock cannot evaluate a keyset, so
    // this proves the cursor names the last row *returned* rather than the
    // overflow row held back, which is the difference between reaching all 120
    // and losing one per page.
    for (let page = 0; page < 2; page++) {
      const result = await service.getProjectIssues(PROJECT_ID, "user_1", false, 100);
      seen.push(...result.items.map((i) => i.id));
      if (!result.hasMore) break;
      const lastId = result.nextCursor?.split("|")[1];
      const after = all.findIndex((i) => i.id === lastId) + 1;
      expect(after).toBeGreaterThan(0);
      issueRows = all.slice(after);
    }

    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
  });

  it("still refuses a project the caller does not own", async () => {
    projectRows = [];

    await expect(
      service.getProjectIssues(PROJECT_ID, "user_1", false, 50),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // The issue query never runs, so no cursor can be used to probe one.
    expect(limits).toEqual([1]);
  });
});
