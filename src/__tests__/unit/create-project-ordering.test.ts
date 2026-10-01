/**
 * `createProject` must not enqueue the Inngest job before the credit charge is
 * known to have succeeded.
 *
 * The order used to be: INSERT project row → `inngest.send` → `spendCredits`.
 * A worker could therefore pick up `project/created` for a project row that a
 * failed charge then deleted, and if the *enqueue* itself failed the user was
 * left with a deleted project but no refund — they paid for nothing.
 *
 * D-11 settled on the `neon-http` driver, so there is no transaction to lean on
 * and the fix is ordering plus explicit compensation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, dbState, spend } = vi.hoisted(() => ({
  calls: [] as string[],
  dbState: {
    selectResult: [] as unknown[],
    spendResult: null as number | null,
    spendThrows: false,
  },
  spend: {
    refund: vi.fn(async (_userId: string, _cost: number, _reason: string) => 90),
  },
}));

function chain() {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(dbState.selectResult).then(resolve),
  };
  for (const method of [
    "select",
    "from",
    "where",
    "limit",
    "values",
    "onConflictDoNothing",
    "set",
    "returning",
    "orderBy",
  ]) {
    builder[method] = () => builder;
  }
  return builder;
}

vi.mock("@/db", () => ({
  db: {
    select: () => chain(),
    insert: () => chain(),
    delete: () => {
      calls.push("db.delete(project)");
      return chain();
    },
    update: () => chain(),
  },
}));

vi.mock("@/src/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn(async () => {
      calls.push("inngest.send");
    }),
  },
}));

vi.mock("@/src/lib/credits", () => ({
  PROJECT_CREATION_COST: 10,
  COMMIT_SUMMARY_COST: 1,
  openCharge: vi.fn(async (userId: string, cost: number, reason: string) => {
    calls.push("spendCredits");
    if (dbState.spendThrows) throw new Error("charge failed");
    if (dbState.spendResult === null) return null;
    return {
      settle: () => {},
      refund: async () => {
        calls.push("refundCredits");
        spend.refund(userId, cost, reason);
      },
    };
  }),
}));

vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(async () => ({ projectId: "project-1" })),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(),
}));

async function createProject() {
  const { createProjectService } = await import(
    "@/src/features/dashboard/server/router/services/projectService"
  );
  return createProjectService().createProject(
    { projectName: "demo", repoUrl: "https://github.com/acme/demo" },
    "user-1",
  );
}

beforeEach(async () => {
  calls.length = 0;
  dbState.selectResult = [{ id: "user-1", credits: 100 }];
  dbState.spendResult = 90;
  dbState.spendThrows = false;
  spend.refund.mockClear();
  const { inngest } = await import("@/src/lib/inngest/client");
  vi.mocked(inngest.send).mockClear();
  vi.mocked(inngest.send).mockImplementation(async () => {
    calls.push("inngest.send");
    return { ids: ["evt-1"] };
  });
});

describe("createProject ordering", () => {
  it("charges before it enqueues", async () => {
    const result = await createProject();

    expect(result.success).toBe(true);
    expect(calls).toEqual(["spendCredits", "inngest.send"]);
  });

  it("enqueues nothing when the charge fails outright", async () => {
    dbState.spendThrows = true;

    await expect(createProject()).rejects.toThrow();

    expect(calls).not.toContain("inngest.send");
    expect(calls).toContain("db.delete(project)");
  });

  it("enqueues nothing and deletes the row when the balance was drained", async () => {
    dbState.spendResult = null;

    await expect(createProject()).rejects.toThrow();

    expect(calls).toEqual(["spendCredits", "db.delete(project)"]);
    expect(spend.refund).not.toHaveBeenCalled();
  });

  it("refunds the charge when the enqueue fails after it succeeded", async () => {
    const { inngest } = await import("@/src/lib/inngest/client");
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("queue down"));

    await expect(createProject()).rejects.toThrow();

    // The refund comes after the row is gone, not before: the charge is only
    // compensated once the compensating write it compensates for has landed.
    expect(calls).toEqual(["spendCredits", "db.delete(project)", "refundCredits"]);
    expect(inngest.send).toHaveBeenCalledTimes(1);
    expect(spend.refund).toHaveBeenCalledWith("user-1", 10, "project_creation");
  });
});
