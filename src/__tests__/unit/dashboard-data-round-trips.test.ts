/**
 * T-030 — the consolidated dashboard read must cost one Neon round-trip, and
 * the payload it returns must not change while it gets there.
 *
 * Before this, `getDashboardData` fanned out through `Promise.all` to seven
 * service calls that issued ten queries between them. They overlapped, so
 * wall-clock cost was the slowest one, not the sum — but each query was still
 * its own stateless HTTP request to the `neon-http` driver (D-11 option (a)),
 * and the T-029 inventory showed `projects` and `commits ⋈ projects` being
 * read three times each for data the first read already contained.
 *
 * The payload is the contract: seven keys, each shaped for a specific widget.
 * These tests pin both the round-trip count and that shape, so the
 * consolidation cannot quietly drop a field.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/** Rows each mocked query resolves to, keyed by the table it selects from. */
const ROWS: Record<string, unknown[]> = {
  projects: [],
  users: [],
  commits: [],
  chats: [],
  issues: [],
};

/** How many times `db.batch` was called, and with how many queries. */
let batchCalls = 0;
let batchSize = 0;

/**
 * A query builder that no-ops the drizzle chain methods and resolves to
 * `rows`. `db.batch` awaits each one, so the batch resolves in order.
 */
function chain(rows: unknown[]) {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve),
  };
  for (const method of [
    "where",
    "orderBy",
    "limit",
    "offset",
    "leftJoin",
    "innerJoin",
    "groupBy",
  ]) {
    builder[method] = () => builder;
  }
  return builder;
}

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.projectTables) return chain(ROWS.projects);
          if (table === schema.usersTable) return chain(ROWS.users);
          if (table === schema.commitsTable) return chain(ROWS.commits);
          if (table === schema.projectChats) return chain(ROWS.chats);
          if (table === schema.issuesTable) return chain(ROWS.issues);
          return chain([]);
        },
      }),
      batch: (queries: unknown[]) => {
        batchCalls++;
        batchSize = queries.length;
        return Promise.all(queries);
      },
    },
  };
});

vi.mock("@/src/lib/inngest/client", () => ({ inngest: { send: async () => {} } }));
vi.mock("@/src/lib/credits", () => ({
  spendCredits: async () => 0,
  PROJECT_CREATION_COST: 0,
  COMMIT_SUMMARY_COST: 0,
}));
vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(),
}));

import { createProjectService } from "@/features/dashboard/server/router/services/projectService";

const PROJECT = {
  id: "proj_1",
  projectName: "gitvision",
  totalCommits: 10,
  totalFiles: 100,
  languages: [
    { name: "TypeScript", color: "#3178c6", size: 800 },
    { name: "Rust", color: "#dea584", size: 200 },
  ],
};

const COMMIT = {
  id: "commit_1",
  commitMessage: "fix: proxy allowlist",
  authorName: "dev",
  authorAvatar: "https://example.test/a.png",
  authorDate: new Date("2026-01-02T00:00:00.000Z"),
  projectId: "proj_1",
  projectName: "gitvision",
  hasSummary: false,
};

const CHAT = {
  id: "chat_1",
  title: "Where is the auth middleware",
  projectId: "proj_1",
  projectName: "gitvision",
  updatedAt: new Date("2026-01-03T00:00:00.000Z"),
};

const ISSUE = {
  id: "issue_1",
  title: "Flaky webhook test",
  issueNumber: 42,
  isPullRequest: false,
  authorLogin: "dev",
  authorAvatar: "https://example.test/d.png",
  projectId: "proj_1",
  projectName: "gitvision",
  githubUpdatedAt: new Date("2026-01-04T00:00:00.000Z"),
  aiComplexity: "medium",
  aiTags: ["testing"],
  openIssues: 4,
  openPRs: 2,
};

function seed() {
  ROWS.projects = [{ ...PROJECT }];
  ROWS.users = [{ credits: 77 }];
  ROWS.commits = [{ ...COMMIT }];
  ROWS.chats = [{ ...CHAT }];
  ROWS.issues = [{ ...ISSUE }];
}

function dashboard() {
  return createProjectService().getDashboardData("user_1");
}

describe("getDashboardData round-trips", () => {
  beforeEach(() => {
    batchCalls = 0;
    batchSize = 0;
    seed();
  });

  it("is one batched request, not seven parallel service calls", async () => {
    await dashboard();

    // One `db.batch` is one HTTP request to the neon-http driver. The ten
    // queries that used to be ten requests are now statements inside it.
    expect(batchCalls).toBe(1);
    expect(batchSize).toBe(6);
  });

  it("keeps the five-key payload", async () => {
    const data = await dashboard();

    expect(Object.keys(data).sort()).toEqual([
      "attention",
      "commitChart",
      "languages",
      "projects",
      "stats",
    ]);
  });
});

describe("getDashboardData derives instead of re-querying", () => {
  beforeEach(() => {
    batchCalls = 0;
    batchSize = 0;
    seed();
  });

  it("sums the stats from the project rows it already fetched", async () => {
    ROWS.projects = [
      { ...PROJECT },
      { ...PROJECT, id: "proj_2", totalCommits: 5, totalFiles: 50, languages: [] },
    ];
    ROWS.users = [];

    const { stats } = await dashboard();

    // The old SQL did SUM(total_commits) / SUM(total_files) / COUNT(id) over
    // the same `WHERE owner_id = ?` rows, so JS over those rows is the same
    // number without a second read of the table.
    expect(stats.totalProjects).toBe(2);
    expect(stats.totalCommits).toBe(15);
    expect(stats.totalFiles).toBe(150);
    expect(stats.userCredits).toBe(0);
  });

  it("builds the language breakdown from the same project rows", async () => {
    const { languages } = await dashboard();

    expect(languages).toEqual([
      { name: "TypeScript", color: "#3178c6", size: 800, percentage: 80 },
      { name: "Rust", color: "#dea584", size: 200, percentage: 20 },
    ]);
  });

  it("does not leak the window-count columns into the attention items", async () => {
    const { attention } = await dashboard();

    expect(attention).toEqual({
      openIssuesCount: 4,
      openPRsCount: 2,
      items: [
        {
          id: "issue_1",
          title: "Flaky webhook test",
          issueNumber: 42,
          isPullRequest: false,
          authorLogin: "dev",
          authorAvatar: "https://example.test/d.png",
          projectId: "proj_1",
          projectName: "gitvision",
          githubUpdatedAt: new Date("2026-01-04T00:00:00.000Z"),
          aiComplexity: "medium",
          aiTags: ["testing"],
        },
      ],
    });
  });
});
