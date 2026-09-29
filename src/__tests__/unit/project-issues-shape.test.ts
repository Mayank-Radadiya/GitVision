/**
 * T-028 — issue payloads must not carry AI-triage fields.
 *
 * `aiSummary` / `aiComplexity` / `aiTags` exist as nullable columns but nothing
 * ever writes them: the issue sync inserted `null as` under a comment describing
 * a Gemini background job that does not exist. Selecting them only shipped three
 * guaranteed-null columns to the client, so every consumer that renders a
 * severity badge or chip label renders an empty affordance. The selects are gone;
 * the columns stay, because dropping them costs a migration and buys nothing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const AI_FIELDS = ["aiSummary", "aiComplexity", "aiTags"];

/** Every projection the code under test asks the database for, in order. */
let projections: Record<string, unknown>[] = [];
/** Rows the mocked issues query returns. */
let issueRows: Record<string, unknown>[] = [];
/** Rows the mocked "needs attention" count aggregate returns. */
let countRows: Record<string, unknown>[] = [];

/** Applies a drizzle projection to a raw row, the way postgres would. */
function project(row: Record<string, unknown>, fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.keys(fields).map((key) => [key, row[key] ?? null]),
  );
}

/** Chainable no-op query builder; `then` resolves the projected rows. */
function chain(fields: Record<string, unknown>, rows: Record<string, unknown>[]) {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(rows.map((row) => project(row, fields))).then(resolve),
  };
  for (const method of [
    "from",
    "where",
    "limit",
    "orderBy",
    "innerJoin",
    "leftJoin",
  ]) {
    builder[method] = () => builder;
  }
  return builder;
}

vi.mock("@/db", () => ({
  db: {
    select: (fields: Record<string, unknown> = {}) => {
      projections.push(fields);
      // The "needs attention" widget issues its count aggregate first, so the
      // projection is what tells the two queries apart.
      const isCountAggregate = "openIssues" in fields;
      return chain(fields, isCountAggregate ? countRows : issueRows);
    },
  },
}));

vi.mock("@/src/lib/guards", () => ({
  assertProjectOwnership: async () => undefined,
}));
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
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  projections = [];
  issueRows = [];
  countRows = [];
  // A fully-populated row: if the projection asked for the AI columns, the
  // payload would carry values rather than being trivially absent.
  issueRows = [
    {
      id: "i1",
      title: "Login button misaligned on Safari",
      issueNumber: 42,
      isPullRequest: false,
      state: "open",
      authorLogin: "octocat",
      authorAvatar: "https://example.invalid/a.png",
      projectId: PROJECT_ID,
      projectName: "octo/hello",
      githubCreatedAt: new Date("2026-01-01T00:00:00Z"),
      githubUpdatedAt: new Date("2026-01-02T00:00:00Z"),
      aiSummary: "Cosmetic regression in Safari only.",
      aiComplexity: "high",
      aiTags: ["ui", "safari"],
    },
  ];
  countRows = [{ openIssues: 3, openPRs: 1 }];
});

describe("issue payloads carry no AI-triage fields", () => {
  it("getProjectIssues returns no AI fields", async () => {
    const issues = await service.getProjectIssues(
      PROJECT_ID,
      "user_1",
      false,
      50,
    );

    expect(issues).toHaveLength(1);
    for (const field of AI_FIELDS) {
      expect(issues[0]).not.toHaveProperty(field);
    }
  });

  it("getProjectIssues still returns the issue itself", async () => {
    const issues = await service.getProjectIssues(
      PROJECT_ID,
      "user_1",
      false,
      50,
    );

    expect(issues[0]).toMatchObject({
      issueNumber: 42,
      title: "Login button misaligned on Safari",
      state: "open",
    });
  });

  it("getNeedsAttention returns no AI fields", async () => {
    const { items, openIssuesCount, openPRsCount } =
      await service.getNeedsAttention("user_1");

    expect(openIssuesCount).toBe(3);
    expect(openPRsCount).toBe(1);
    expect(items).toHaveLength(1);
    for (const field of AI_FIELDS) {
      expect(items[0]).not.toHaveProperty(field);
    }
  });

  it("no query projects an AI-triage column", async () => {
    await service.getProjectIssues(PROJECT_ID, "user_1", false, 50);
    await service.getNeedsAttention("user_1");

    expect(projections.length).toBeGreaterThan(0);
    for (const fields of projections) {
      for (const field of AI_FIELDS) {
        expect(fields).not.toHaveProperty(field);
      }
    }
  });
});
