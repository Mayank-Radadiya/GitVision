import { beforeEach, describe, expect, it, vi } from "vitest";

// The destructive delete this task removed lived in the *caller*
// (projectService.syncIssues), not in the GitHub service, so it is tested
// here. Without this, a regression that re-adds
// `db.delete(issuesTable).where(eq(projectId))` before the pull would pass
// every assertion in issues-sync.test.ts.
let events: string[] = [];

const tableNames = vi.hoisted(() => new Map<object, string>());

vi.mock("@/db", async () => {
  const { issuesTable, projectTables } = await import("@/db/schema");
  tableNames.set(issuesTable, "issues");
  tableNames.set(projectTables, "projects");

  const chain = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {};
    const settle = (value: unknown[]) => ({
      then: (ok?: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
        Promise.resolve(value).then(ok, err),
      catch: (err: (e: unknown) => unknown) => Promise.resolve(value).catch(err),
      finally: (end?: () => unknown) => Promise.resolve(value).finally(end),
    });
    for (const method of [
      "from",
      "where",
      "limit",
      "orderBy",
      "set",
      "values",
      "onConflictDoUpdate",
      "returning",
    ]) {
      builder[method] = () => builder;
    }
    Object.assign(builder, settle(rows));
    return builder;
  };

  return {
    db: {
      // The project lookup: syncIssues needs githubUrl before it can pull.
      select: () => chain([{ githubUrl: "https://github.com/acme/widgets" }]),
      delete: (table: object) => {
        events.push(`delete:${tableNames.get(table) ?? "unknown"}`);
        return chain([]);
      },
      insert: (table: object) => {
        events.push(`insert:${tableNames.get(table) ?? "unknown"}`);
        return chain([]);
      },
      update: () => chain([]),
    },
  };
});

vi.mock("@/src/lib/guards", () => ({
  assertProjectOwnership: vi.fn(async () => ({ id: "project-1" })),
  ProjectAccessError: class extends Error {},
}));

// projectService imports syncIssuesAndComments from the barrel
// "@/src/lib/github", so the barrel is what has to be mocked. Mocking the
// deep module instead would silently not apply.
vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(async () => {
    events.push("pull");
    return { issuesFetched: 3, commentsFetched: 2, truncated: true };
  }),
}));

import { createProjectService } from "@/src/features/dashboard/server/router/services/projectService";

const PROJECT = "project-1";

beforeEach(() => {
  events = [];
});

describe("projectService.syncIssues", () => {
  it("never deletes before the GitHub pull has succeeded", async () => {
    const service = createProjectService();

    await service.syncIssues(PROJECT, "user-1");

    // The old implementation opened with
    // `db.delete(issuesTable).where(eq(projectId))`. neon-http has no
    // transaction, so a GitHub 500, a rate limit or a dropped connection
    // after that line left the project with zero issues and no way back.
    expect(events).not.toContain("delete:issues");
    expect(events).toContain("pull");
  });

  it("passes the truncation flag through instead of hiding a capped sync", async () => {
    const service = createProjectService();

    const result = await service.syncIssues(PROJECT, "user-1");

    expect(result.truncated).toBe(true);
    expect(result.issuesFetched).toBe(3);
    expect(result.commentsFetched).toBe(2);
  });
});
