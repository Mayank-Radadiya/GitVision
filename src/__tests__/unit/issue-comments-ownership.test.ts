/**
 * T11 — `getIssueComments` must not distinguish "no such issue" from
 * "not your issue".
 *
 * The service used to look the issue up by id first and only then check
 * ownership, so the two failures produced two different messages. That is an
 * existence oracle: an attacker could enumerate issue ids belonging to other
 * tenants by reading the error text. The fix folds the owner check into the
 * first query so there is only one outcome to observe.
 *
 * T50 extended this: adding a cursor must not reintroduce the oracle, so the
 * parity cases are re-run against the new `{ comments, hasMore, nextCursor }`
 * shape. A cursor that filtered comments separately from the ownership check
 * would let a caller walk another tenant's thread one page at a time.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** Rows the mocked issue lookup returns. */
let issueRows: unknown[] = [];
/** Rows the mocked ownership lookup returns. */
let projectRows: unknown[] = [];
/** Rows the mocked comment query returns. */
let commentRows: unknown[] = [];
/** Every `limit(n)` the mocked builder was asked for, in call order. */
let limits: number[] = [];

/** Chainable no-op query builder; `then` resolves to `rows`.
 *
 * `limit` is honoured, unlike every other builder method. Over-fetching by one
 * is the whole mechanism T50 relies on to report `hasMore`, and a mock that
 * ignored `limit` would hand the service every row and make the assertion pass
 * for a service that never over-fetched.
 */
function chain(rows: unknown[] = []) {
  const builder: Record<string, unknown> = {
    joined: false,
    capped: Number.POSITIVE_INFINITY,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(
        rows.slice(0, builder.capped as number) as unknown[],
      ).then(resolve),
  };
  for (const method of [
    "select",
    "from",
    "where",
    "orderBy",
    "leftJoin",
    "set",
    "values",
    "returning",
    "insert",
    "update",
    "delete",
  ]) {
    builder[method] = () => builder;
  }
  builder.limit = (n: number) => {
    limits.push(n);
    builder.capped = Math.min(builder.capped as number, n);
    return builder;
  };
  // An innerJoin with the projects table is what makes the owner predicate part
  // of the same statement, so the mock has to honour it: a joined issues query
  // yields no row unless the issue's project is the caller's.
  builder.innerJoin = () => {
    builder.joined = true;
    return builder;
  };
  return builder;
}

/** Projects the caller owns, per the mocked `projects` table. */
let ownedProjectIds: string[] = [];

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.projectTables) return chain(projectRows);
          if (table === schema.issueCommentsTable) return chain(commentRows);
          if (table === schema.issuesTable) {
            const b = chain(issueRows);
            const original = b.then as (r: (v: unknown) => unknown) => unknown;
            b.then = (resolve: (v: unknown) => unknown) => {
              const rows = b.joined
                ? issueRows.filter(
                    (r) =>
                      ownedProjectIds.includes(
                        (r as { projectId: string }).projectId,
                      ),
                  )
                : issueRows;
              return Promise.resolve(rows).then(resolve);
            };
            void original;
            return b;
          }
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
const ISSUE_ID = "11111111-1111-4111-8111-111111111111";

/** Normalises a thrown TRPCError to the pair the caller can actually observe. */
async function observeFailure(): Promise<{ code: string; message: string }> {
  try {
    await service.getIssueComments(ISSUE_ID, "user_1");
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code ?? "", message: e.message ?? "" };
  }
  return { code: "<resolved>", message: "<resolved>" };
}

beforeEach(() => {
  issueRows = [];
  projectRows = [];
  commentRows = [];
  ownedProjectIds = [];
  limits = [];
});

describe("getIssueComments error parity", () => {
  it("reports a missing issue and someone else's issue identically", async () => {
    // Case A: the issue does not exist at all.
    issueRows = [];
    projectRows = [{ ownerId: "user_1" }];
    const missing = await observeFailure();

    // Case B: the issue exists, but belongs to a different tenant.
    issueRows = [{ projectId: "p_other" }];
    projectRows = [];
    const notYours = await observeFailure();

    expect(missing).toEqual(notYours);
  });

  it("uses a single NOT_FOUND code for both cases", async () => {
    issueRows = [{ projectId: "p_other" }];
    projectRows = [];

    const failure = await observeFailure();

    expect(failure.code).toBe("NOT_FOUND");
  });

  it("does not name the project in the message", async () => {
    issueRows = [{ projectId: "p_other" }];
    projectRows = [];

    const failure = await observeFailure();

    expect(failure.message).not.toMatch(/project/i);
  });

  it("still returns comments for an issue the caller owns", async () => {
    issueRows = [{ projectId: "p_mine" }];
    ownedProjectIds = ["p_mine"];
    projectRows = [{ ownerId: "user_1" }];
    commentRows = [{ id: "c1", body: "hi" }];

    const { comments } = await service.getIssueComments(ISSUE_ID, "user_1");

    expect(comments).toHaveLength(1);
  });
});

/** A thread of `count` comments, oldest first, one hour apart. */
function threadOf(count: number) {
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  return Array.from({ length: count }, (_, i) => ({
    id: `c${String(i).padStart(3, "0")}`,
    body: `comment ${i}`,
    authorLogin: "octocat",
    authorAvatar: null,
    githubCreatedAt: new Date(base + i * 3_600_000),
  }));
}

/** An issue the caller owns, so the comment query is reached. */
function ownIssue() {
  issueRows = [{ projectId: "p_mine" }];
  ownedProjectIds = ["p_mine"];
  projectRows = [{ ownerId: "user_1" }];
}

describe("getIssueComments pagination", () => {
  it("over-fetches by one so the last comment is not silently dropped", async () => {
    ownIssue();
    commentRows = threadOf(3);

    // The old code asked for exactly `limit` and returned whatever came back, so
    // a caller had no way to learn row four existed.
    await service.getIssueComments(ISSUE_ID, "user_1", 2);

    // 1 is the ownership lookup; 3 is `limit + 1` on the comment query.
    expect(limits).toEqual([1, 3]);
  });

  it("reports no more comments when the thread fits in one page", async () => {
    ownIssue();
    commentRows = threadOf(3);

    const page = await service.getIssueComments(ISSUE_ID, "user_1", 5);

    expect(page.comments).toHaveLength(3);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("reports more comments and a cursor when the thread overflows", async () => {
    ownIssue();
    commentRows = threadOf(3);

    const page = await service.getIssueComments(ISSUE_ID, "user_1", 2);

    expect(page.comments.map((c) => c.id)).toEqual(["c000", "c001"]);
    expect(page.hasMore).toBe(true);
    // The cursor names the last row *returned*, not the row fetched and held
    // back, or the next page would skip one.
    expect(page.nextCursor).toContain("c001");
  });

  it("reaches every comment of a 60-comment thread by following the cursor", async () => {
    ownIssue();
    const all = threadOf(60);
    commentRows = all;

    const seen: string[] = [];
    // The mock is a builder, not a database, so it cannot evaluate the keyset
    // predicate. What it can prove is the cursor *contract*: the cursor must
    // name the last row handed back, because that is the row the next page's
    // predicate is built from. Each iteration therefore serves the rows after
    // whatever the previous cursor named — if the cursor named the held-back
    // overflow row instead, this loop would skip one comment per page and the
    // id set would come out short.
    for (let page = 0; page < 3; page++) {
      const result = await service.getIssueComments(ISSUE_ID, "user_1", 25);
      seen.push(...result.comments.map((c) => c.id));
      if (!result.hasMore) break;
      const lastId = result.nextCursor?.split("|")[1];
      const after = all.findIndex((c) => c.id === lastId) + 1;
      expect(after).toBeGreaterThan(0);
      commentRows = all.slice(after);
    }

    expect(seen).toHaveLength(60);
    expect(new Set(seen).size).toBe(60);
    expect(seen).toEqual(all.map((c) => c.id));
  });

  it("fails a missing and a borrowed issue identically even with a cursor", async () => {
    const missing = await (async () => {
      issueRows = [];
      return observeFailureWith("2026-01-01T00:00:00.000Z|c000");
    })();

    issueRows = [{ projectId: "p_other" }];
    const notYours = await observeFailureWith("2026-01-01T00:00:00.000Z|c000");

    expect(missing).toEqual(notYours);
    expect(missing.code).toBe("NOT_FOUND");
  });
});

/** A malformed or valid cursor supplied to the ownership probe. */
async function observeFailureWith(
  cursor: string,
): Promise<{ code: string; message: string }> {
  try {
    await service.getIssueComments(ISSUE_ID, "user_1", 50, cursor);
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code ?? "", message: e.message ?? "" };
  }
  return { code: "<resolved>", message: "<resolved>" };
}
