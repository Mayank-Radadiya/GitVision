/**
 * T-050 — issue and comment pagination must be honest.
 *
 * Both endpoints used to return a bare array: `getIssueComments` truncated at
 * 50 and `getProjectIssues` at the caller's limit, with no signal that more rows
 * existed. A 60-comment thread was unreachable and no issue list could be paged
 * past 100. Both now return `{ items, hasMore, nextCursor }` and both page with
 * a keyset cursor over a unique column pair, so a row is never skipped or
 * repeated when two rows share the same timestamp.
 *
 * The pattern mirrors `chat-pagination.test.ts`: over-fetch one row past the
 * requested limit and treat the overflow as the "there is a next page" proof.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const ISSUE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user_1";

/** One record per query the service issues, so we can assert the contract. */
const calls: {
  table: unknown;
  where: unknown;
  orderBy: unknown;
  limit: number | undefined;
}[] = [];

let pageRows: unknown[] = [];

function makeRows(pick: () => unknown[]) {
  const builder: Record<string, unknown> = {
    where: (cond: unknown) => {
      calls[calls.length - 1].where = cond;
      return builder;
    },
    orderBy: (clause: unknown) => {
      calls[calls.length - 1].orderBy = clause;
      return builder;
    },
    innerJoin: () => builder,
    leftJoin: () => builder,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(pick()).then(resolve),
  };
  builder.limit = (n: number) => {
    calls[calls.length - 1].limit = n;
    return builder;
  };
  return builder;
}

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        // `from` is where a query starts, so that is where its call record is
        // written. Every later clause mutates that record in place.
        from: (table: unknown) => {
          calls.push({ table, where: undefined, orderBy: undefined, limit: undefined });
          // issuesTable serves two roles across these two methods: the page in
          // getProjectIssues, and the issue→project ownership lookup in
          // getIssueComments (which only asserts the result is non-empty). The
          // comment page itself is the issueCommentsTable query.
          if (table === schema.issueCommentsTable || table === schema.issuesTable) {
            return makeRows(() => pageRows);
          }
          // assertProjectOwnership, which getProjectIssues runs first.
          if (table === schema.projectTables) {
            return makeRows(() => [{ id: PROJECT_ID, ownerId: USER_ID }]);
          }
          return makeRows(() => []);
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
  syncIssuesAndComments: async () => ({
    issues: 0,
    pullRequests: 0,
    truncated: false,
  }),
}));

import { createProjectService } from "@/src/features/dashboard/server/router/services/projectService";

const service = createProjectService();

function issue(n: number, updatedAt: string) {
  return {
    id: `issue-${n}`,
    issueNumber: n,
    title: `Issue ${n}`,
    githubUpdatedAt: new Date(updatedAt),
    githubCreatedAt: new Date(updatedAt),
  };
}

function comment(n: number, createdAt: string) {
  return {
    id: `comment-${n}`,
    body: `body ${n}`,
    authorLogin: "someone",
    authorAvatar: null,
    githubCreatedAt: new Date(createdAt),
  };
}

beforeEach(() => {
  calls.length = 0;
  pageRows = [];
});

describe("getProjectIssues shape", () => {
  it("returns items/hasMore/nextCursor, not a bare array", async () => {
    pageRows = [issue(1, "2026-01-01T00:00:00Z")];

    const result = await service.getProjectIssues(
      PROJECT_ID,
      USER_ID,
      false,
      10,
    );

    expect(Array.isArray(result)).toBe(false);
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("hasMore");
    expect(result).toHaveProperty("nextCursor");
  });

  it("over-fetches by one so the overflow can prove a next page exists", async () => {
    pageRows = [issue(1, "2026-01-01T00:00:00Z")];

    await service.getProjectIssues(PROJECT_ID, USER_ID, false, 10);

    expect(calls[calls.length - 1].limit).toBe(11);
  });

  it("slices the sentinel row off and reports hasMore", async () => {
    pageRows = [
      issue(1, "2026-01-03T00:00:00Z"),
      issue(2, "2026-01-02T00:00:00Z"),
      issue(3, "2026-01-01T00:00:00Z"),
    ];

    const result = await service.getProjectIssues(
      PROJECT_ID,
      USER_ID,
      false,
      2,
    );

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.issueNumber)).toEqual([1, 2]);
    expect(result.hasMore).toBe(true);
  });

  it("reports no more rows and a null cursor on an exact page", async () => {
    pageRows = [issue(1, "2026-01-02T00:00:00Z"), issue(2, "2026-01-01T00:00:00Z")];

    const result = await service.getProjectIssues(
      PROJECT_ID,
      USER_ID,
      false,
      2,
    );

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("cursors on the last row it returned, carrying both sort keys", async () => {
    pageRows = [
      issue(1, "2026-01-03T00:00:00Z"),
      issue(2, "2026-01-02T00:00:00Z"),
      issue(3, "2026-01-01T00:00:00Z"),
    ];

    const result = await service.getProjectIssues(
      PROJECT_ID,
      USER_ID,
      false,
      2,
    );

    // github_updated_at is not unique, so the id has to ride along or every row
    // sharing that timestamp is skipped on the next page.
    expect(result.nextCursor).toEqual({
      githubUpdatedAt: new Date("2026-01-02T00:00:00Z"),
      id: "issue-2",
    });
  });

  it("adds a keyset predicate to the query only when a cursor is supplied", async () => {
    pageRows = [issue(1, "2026-01-01T00:00:00Z")];

    await service.getProjectIssues(PROJECT_ID, USER_ID, false, 10);
    const firstPage = calls[calls.length - 1].where;

    pageRows = [];
    await service.getProjectIssues(PROJECT_ID, USER_ID, false, 10, {
      githubUpdatedAt: new Date("2026-01-02T00:00:00Z"),
      id: "issue-2",
    });
    const secondPage = calls[calls.length - 1].where;

    expect(firstPage).toBeDefined();
    expect(secondPage).toBeDefined();
    // A different SQL object means the cursor actually reached the statement.
    expect(secondPage).not.toBe(firstPage);
  });
});

describe("getIssueComments shape", () => {
  it("returns items/hasMore/nextCursor, not a bare array", async () => {
    pageRows = [comment(1, "2026-01-01T00:00:00Z")];

    const result = await service.getIssueComments(ISSUE_ID, USER_ID, 10);

    expect(Array.isArray(result)).toBe(false);
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("hasMore");
    expect(result).toHaveProperty("nextCursor");
  });

  it("over-fetches by one so the overflow can prove a next page exists", async () => {
    pageRows = [comment(1, "2026-01-01T00:00:00Z")];

    await service.getIssueComments(ISSUE_ID, USER_ID, 10);

    expect(calls[calls.length - 1].limit).toBe(11);
  });

  it("slices the sentinel row off and reports hasMore", async () => {
    pageRows = [
      comment(1, "2026-01-01T00:00:00Z"),
      comment(2, "2026-01-02T00:00:00Z"),
      comment(3, "2026-01-03T00:00:00Z"),
    ];

    const result = await service.getIssueComments(ISSUE_ID, USER_ID, 2);

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });

  it("reports no more rows and a null cursor on an exact page", async () => {
    pageRows = [comment(1, "2026-01-01T00:00:00Z"), comment(2, "2026-01-02T00:00:00Z")];

    const result = await service.getIssueComments(ISSUE_ID, USER_ID, 2);

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("cursors on the last row it returned, carrying both sort keys", async () => {
    pageRows = [
      comment(1, "2026-01-01T00:00:00Z"),
      comment(2, "2026-01-02T00:00:00Z"),
      comment(3, "2026-01-03T00:00:00Z"),
    ];

    const result = await service.getIssueComments(ISSUE_ID, USER_ID, 2);

    expect(result.nextCursor).toEqual({
      githubCreatedAt: new Date("2026-01-02T00:00:00Z"),
      id: "comment-2",
    });
  });
});
