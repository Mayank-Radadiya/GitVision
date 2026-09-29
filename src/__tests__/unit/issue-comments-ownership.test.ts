/**
 * T11 — `getIssueComments` must not distinguish "no such issue" from
 * "not your issue".
 *
 * The service used to look the issue up by id first and only then check
 * ownership, so the two failures produced two different messages. That is an
 * existence oracle: an attacker could enumerate issue ids belonging to other
 * tenants by reading the error text. The fix folds the owner check into the
 * first query so there is only one outcome to observe.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** Rows the mocked issue lookup returns. */
let issueRows: unknown[] = [];
/** Rows the mocked ownership lookup returns. */
let projectRows: unknown[] = [];
/** Rows the mocked comment query returns. */
let commentRows: unknown[] = [];

/** Chainable no-op query builder; `then` resolves to `rows`. */
function chain(rows: unknown[] = []) {
  const builder: Record<string, unknown> = {
    joined: false,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
  for (const method of [
    "select",
    "from",
    "where",
    "limit",
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

    const comments = await service.getIssueComments(ISSUE_ID, "user_1");

    expect(comments).toHaveLength(1);
  });
});
