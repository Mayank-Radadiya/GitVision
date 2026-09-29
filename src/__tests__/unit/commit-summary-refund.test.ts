/**
 * A commit summary is billed. If the model call fails, the caller must not be
 * charged for a summary they never got.
 *
 * `generateAiSummary` spends `COMMIT_SUMMARY_COST` before doing any work, so a
 * provider failure has to refund. It used to: `getAiSummaryOfCommit` swallowed
 * the error and returned a "😥 Sorry, something went wrong" string, which the
 * caller could not tell apart from a real summary — and it kept the credit.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    projectRows: [] as unknown[],
    commitRows: [] as unknown[],
    projectTable: undefined as unknown,
    commitsTable: undefined as unknown,
    summaryImpl: async (_url: string, _hash: string) => "a real summary",
    refunds: [] as number[],
  },
}));

vi.mock("@/db", () => {
  const builderFor = (rows: unknown) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["from", "where", "leftJoin", "innerJoin", "orderBy", "limit"]) {
      builder[method] = () => builder;
    }
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve);
    return builder;
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) =>
          builderFor(table === state.commitsTable ? state.commitRows : state.projectRows),
      }),
    },
  };
});

vi.mock("@/src/lib/credits", () => ({
  spendCredits: async () => 42,
  refundCredits: async (_userId: string, cost: number) => {
    state.refunds.push(cost);
    return 42 + cost;
  },
  PROJECT_CREATION_COST: 10,
  COMMIT_SUMMARY_COST: 3,
}));

vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  syncIssuesAndComments: vi.fn(),
  getAiSummaryOfCommit: (...args: [string, string]) => state.summaryImpl(...args),
}));

vi.mock("@/src/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { createProjectService } from "@/src/features/dashboard/server/router/services/projectService";

const USER_ID = "user_1";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const COMMIT_ID = "44444444-4444-4444-8444-444444444444";

beforeAll(async () => {
  const schema = await import("@/db/schema");
  state.projectTable = schema.projectTables;
  state.commitsTable = schema.commitsTable;
});

beforeEach(() => {
  state.projectRows = [{ id: PROJECT_ID, ownerId: USER_ID, githubUrl: "https://github.com/o/r" }];
  state.commitRows = [{ id: COMMIT_ID, commitHash: "abc123" }];
  state.summaryImpl = async () => "a real summary";
  state.refunds = [];
});

describe("generateAiSummary billing", () => {
  it("charges exactly the summary cost when the model answers", async () => {
    const summary = await createProjectService().generateAiSummary(
      PROJECT_ID,
      COMMIT_ID,
      USER_ID,
    );

    expect(summary).toBe("a real summary");
    expect(state.refunds).toEqual([]);
  });

  it("refunds the credit when the model call fails", async () => {
    state.summaryImpl = async () => {
      throw new Error("model provider is down");
    };

    await expect(
      createProjectService().generateAiSummary(PROJECT_ID, COMMIT_ID, USER_ID),
    ).rejects.toThrow();

    expect(state.refunds).toEqual([3]);
  });
});
