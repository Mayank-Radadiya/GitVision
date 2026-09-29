import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { useUserProjects } = vi.hoisted(() => ({ useUserProjects: vi.fn() }));

vi.mock("@/src/features/dashboard/hooks/use-dashboard", () => ({
  useUserProjects,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// The service imports the GitHub client, which throws at import time without a
// token. None of it is exercised here.
vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(),
}));

import ProjectList from "@/src/features/dashboard/components/project-list/project-list";

// ── The dashboard payload contract ───────────────────────────────────────────
// T-030 merged ten Neon round-trips into three. The payload is the contract
// the widgets consume, so it is pinned here: the shape must be identical, and
// the trip count must not creep back up.

const { dbSpy } = vi.hoisted(() => ({
  dbSpy: { selects: 0, rows: [] as unknown[][] },
}));

vi.mock("@/db", () => ({
  db: {
    select: () => {
      const index = dbSpy.selects++;
      const builder: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(dbSpy.rows[index] ?? []).then(resolve),
      };
      for (const method of [
        "from",
        "leftJoin",
        "innerJoin",
        "where",
        "orderBy",
        "groupBy",
        "limit",
      ]) {
        builder[method] = () => builder;
      }
      return builder;
    },
  },
}));

const PROJECT_KEYS = [
  "createdAt",
  "embeddingStatus",
  "forks",
  "githubUrl",
  "id",
  "languages",
  "projectName",
  "star",
  "totalBranches",
  "totalCommits",
  "totalContributors",
  "totalFiles",
  "updatedAt",
];

const ACTIVITY_KEYS = [
  "authorAvatar",
  "authorDate",
  "authorName",
  "commitMessage",
  "id",
  "projectId",
  "projectName",
];

const ATTENTION_ITEM_KEYS = [
  "aiComplexity",
  "aiTags",
  "authorAvatar",
  "authorLogin",
  "githubUpdatedAt",
  "id",
  "isPullRequest",
  "issueNumber",
  "projectId",
  "projectName",
  "title",
];

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    projectName: "demo",
    githubUrl: "https://github.com/acme/demo",
    star: 10,
    forks: 2,
    totalCommits: 40,
    totalBranches: 3,
    totalContributors: 5,
    totalFiles: 120,
    languages: [
      { name: "TypeScript", color: "#3178c6", size: 900 },
      { name: "CSS", color: "#663399", size: 100 },
    ],
    embeddingStatus: "completed",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    userCredits: 96,
    windowTotalCommits: 40,
    windowTotalFiles: 120,
    windowTotalProjects: 1,
    lastChat: {
      id: "chat-1",
      title: "Where is the auth flow",
      projectId: "p-1",
      projectName: "demo",
      updatedAt: new Date("2026-01-03T00:00:00.000Z").toISOString(),
    },
    ...overrides,
  };
}

function commitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "c-1",
    commitMessage: "feat: add the thing that makes the dashboard faster",
    authorName: "A Contributor",
    authorAvatar: "https://avatars.githubusercontent.com/u/1",
    authorDate: new Date("2026-01-04T00:00:00.000Z"),
    projectId: "p-1",
    projectName: "demo",
    hasSummary: true,
    chart: [{ date: "2026-01-04", commits: 3 }],
    ...overrides,
  };
}

function issueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "i-1",
    title: "Login fails on Safari",
    issueNumber: 42,
    isPullRequest: false,
    authorLogin: "someone",
    authorAvatar: "https://avatars.githubusercontent.com/u/2",
    projectId: "p-1",
    projectName: "demo",
    githubUpdatedAt: new Date("2026-01-05T00:00:00.000Z"),
    aiComplexity: null,
    aiTags: null,
    counts: { openIssues: 4, openPRs: 1 },
    ...overrides,
  };
}

describe("getDashboardData", () => {
  beforeEach(() => {
    dbSpy.selects = 0;
    dbSpy.rows = [[projectRow()], [commitRow()], [issueRow()]];
  });

  it("loads the whole dashboard in at most three Neon round-trips", async () => {
    const { createProjectService } = await import(
      "@/src/features/dashboard/server/router/services/projectService"
    );

    await createProjectService().getDashboardData("user-1");

    expect(dbSpy.selects).toBeLessThanOrEqual(3);
  });

  it("keeps the payload shape the widgets consume", async () => {
    const { createProjectService } = await import(
      "@/src/features/dashboard/server/router/services/projectService"
    );

    const data = await createProjectService().getDashboardData("user-1");

    expect(Object.keys(data).sort()).toEqual([
      "attention",
      "commitChart",
      "languages",
      "pickUp",
      "projects",
      "recentActivity",
      "stats",
    ]);
    expect(Object.keys(data.stats).sort()).toEqual([
      "totalCommits",
      "totalFiles",
      "totalProjects",
      "userCredits",
    ]);
    expect(Object.keys(data.projects[0]!).sort()).toEqual(PROJECT_KEYS);
    expect(Object.keys(data.recentActivity[0]!).sort()).toEqual(ACTIVITY_KEYS);
    expect(Object.keys(data.commitChart[0]!).sort()).toEqual([
      "commits",
      "date",
    ]);
    expect(Object.keys(data.languages[0]!).sort()).toEqual([
      "color",
      "name",
      "percentage",
      "size",
    ]);
    expect(Object.keys(data.attention).sort()).toEqual([
      "items",
      "openIssuesCount",
      "openPRsCount",
    ]);
    expect(Object.keys(data.attention.items[0]!).sort()).toEqual(
      ATTENTION_ITEM_KEYS,
    );
  });

  it("carries the real values through, not just the keys", async () => {
    const { createProjectService } = await import(
      "@/src/features/dashboard/server/router/services/projectService"
    );

    const data = await createProjectService().getDashboardData("user-1");

    expect(data.stats).toEqual({
      totalProjects: 1,
      totalCommits: 40,
      totalFiles: 120,
      userCredits: 96,
    });
    expect(data.commitChart).toEqual([{ date: "2026-01-04", commits: 3 }]);
    // TypeScript 900 of 1000 bytes = 90%
    expect(data.languages).toEqual([
      { name: "TypeScript", color: "#3178c6", size: 900, percentage: 90 },
      { name: "CSS", color: "#663399", size: 100, percentage: 10 },
    ]);
    expect(data.attention.openIssuesCount).toBe(4);
    expect(data.attention.openPRsCount).toBe(1);
    expect(data.pickUp.cards[0]).toMatchObject({
      type: "chat",
      title: "Continue Conversation",
      href: "/projects/p-1/chat/chat-1",
    });
  });

  it("returns empty collections rather than placeholder rows for a new user", async () => {
    // users LEFT JOIN projects always yields one row, even with no projects.
      dbSpy.rows = [
      [
        projectRow({
          id: null,
          projectName: null,
          githubUrl: null,
          languages: null,
          windowTotalCommits: 0,
          windowTotalFiles: 0,
          windowTotalProjects: 0,
          lastChat: null,
        }),
      ],
      [],
      [],
    ];

    const { createProjectService } = await import(
      "@/src/features/dashboard/server/router/services/projectService"
    );
    const data = await createProjectService().getDashboardData("user-1");

    expect(data.projects).toEqual([]);
    expect(data.languages).toEqual([]);
    expect(data.recentActivity).toEqual([]);
    expect(data.commitChart).toEqual([]);
    expect(data.attention.items).toEqual([]);
    expect(data.attention.openIssuesCount).toBe(0);
    expect(data.attention.openPRsCount).toBe(0);
    expect(data.pickUp.cards).toEqual([]);
    expect(data.stats).toEqual({
      totalProjects: 0,
      totalCommits: 0,
      totalFiles: 0,
      userCredits: 96,
    });
  });
});

describe("ProjectList error state", () => {
  beforeEach(() => {
    useUserProjects.mockReset();
  });

  it("does not tell the user to create a project when the query failed", () => {
    useUserProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("backend down"),
    });

    render(<ProjectList />);

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t load your projects/i);
    expect(screen.queryByText(/no projects yet/i)).not.toBeInTheDocument();
  });
});
