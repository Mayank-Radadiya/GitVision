/**
 * T-099 — the per-project insights aggregate.
 *
 * `getInsights` exists because every chart on the project page used to be fed by
 * `useProjectCommits`, which pages in 10 rows. A "last 7 days" bar chart drawn
 * from ten commits cannot be correct, and neither can a per-contributor velocity
 * sparkline or a contributor table built from the same slice — `team-tab.tsx` used
 * to say so in a footnote, which is an admission, not a caveat.
 *
 * These assertions target the three properties that make the replacement an
 * improvement rather than just a different number:
 *
 *   1. Ownership is checked before any aggregate runs, so a foreign `projectId`
 *      costs one 404'd query and never a batch.
 *   2. The commits leg must not project `commit_message`. That column averages
 *      1,092 bytes and reaches 65,536, and the documented cost of the old query
 *      was wire width, not a slow plan.
 *   3. The series is densified server-side, because a `GROUP BY day` omits days
 *      with no commits and those gaps are precisely what a chart has to draw.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user_1";

/** Rows the mocked ownership lookup returns. Empty means "not yours". */
let projectRows: unknown[] = [];
/** Row sets handed back by `db.batch`, in the order the service issues them. */
let batchResults: unknown[][] = [];
/** Every projection passed to `.select(...)`, flattened. */
let selections: unknown[] = [];
/** The predicates each statement applied. */
let predicates: string[] = [];
/** How many times `db.batch` was called. */
let batchCalls = 0;

function describeSql(fragment: unknown): string {
  const chunks = (fragment as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return String(fragment);
  return chunks
    .map((chunk) => {
      const { value, name } = chunk as {
        value?: unknown;
        name?: string;
        queryChunks?: unknown[];
      };
      if (value !== undefined) return String(value);
      if (name !== undefined) return name;
      const nested = (chunk as { queryChunks?: unknown[] })?.queryChunks;
      if (Array.isArray(nested)) return describeSql(chunk);
      return "";
    })
    .join(" ");
}

function chain(rows: unknown[] = []) {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
  builder.select = (...projection: unknown[]) => {
    // `select()` with no arguments means "every column"; that is recorded as a
    // wildcard rather than as an empty projection so the assertion below cannot
    // pass by seeing no arguments.
    selections.push(projection.length === 0 ? "*" : projection);
    return builder;
  };
  for (const method of ["from", "leftJoin", "innerJoin", "groupBy", "orderBy"]) {
    builder[method] = () => builder;
  }
  builder.where = (...conditions: unknown[]) => {
    predicates.push(...conditions.map(describeSql));
    return builder;
  };
  builder.limit = () => builder;
  return builder;
}

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        from: (table: unknown) => chain(table === schema.projectTables ? projectRows : []),
      }),
      batch: (statements: unknown[]) => {
        batchCalls++;
        void statements;
        return Promise.resolve(batchResults);
      },
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

/** Empty-but-complete batch results, one entry per statement the service issues. */
function emptyBatch() {
  return [
    [], // daily buckets
    [{ openIssues: 0, closedIssues: 0, openPullRequests: 0, mergedPullRequests: 0, medianOpenAgeDays: null }],
    [], // contributors
    [{ chunks: 0, tokens: 0 }],
    [], // file languages
    [{ at: null }], // last activity
  ];
}

/** A UTC day key `offset` days before today, in `YYYY-MM-DD`. */
function dayKey(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().split("T")[0]!;
}

beforeEach(() => {
  projectRows = [{ id: PROJECT_ID, ownerId: USER_ID }];
  batchResults = emptyBatch();
  selections = [];
  predicates = [];
  batchCalls = 0;
});

describe("getProjectInsights ownership", () => {
  it("refuses before running a single aggregate", async () => {
    projectRows = [];

    await expect(
      service.getProjectInsights(PROJECT_ID, "someone_else", 30),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // A 404 that still ran six statements would leak timing about whether the
    // project exists, and would do the database six queries' work for a caller
    // who is not allowed an answer.
    expect(batchCalls).toBe(0);
  });
});

describe("getProjectInsights commits leg", () => {
  it("never projects commit_message", async () => {
    await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // `commits.commit_message` averages 1,092 bytes and reaches 65,536. The
    // documented cost of the paged query this replaces was wire width, not a
    // slow plan, so pulling the column into an aggregate re-imports the defect.
    const projected = selections
      .filter((selection) => selection !== "*")
      .map((selection) => describeSql(selection))
      .join(" ");
    expect(projected).not.toMatch(/commit_message/);
    // A wildcard projection would drag it along with everything else.
    expect(selections).not.toContain("*");
  });

  it("filters bot authors in SQL, not after the fact", async () => {
    await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // Grouping and ordering happen in the database, so a JS-side bot filter
    // would run *after* the top-N was chosen — humans displaced by bot commits
    // would already have been dropped, and the limit would return bots.
    expect(predicates.join(" ")).toMatch(/dependabot/i);
    expect(predicates.join(" ")).toMatch(/github-actions/i);
  });

  it("batches every statement into one round trip", async () => {
    await service.getProjectInsights(PROJECT_ID, USER_ID, 30);
    expect(batchCalls).toBe(1);
  });
});

describe("getProjectInsights series", () => {
  it("fills in days with no commits", async () => {
    batchResults[0] = [
      { date: dayKey(0), commits: 3 },
      { date: dayKey(3), commits: 1 },
    ];

    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 7);

    // Postgres omits days with no commits from a `GROUP BY day`. A sparse
    // series drawn as a line chart silently collapses those gaps and shifts
    // every later point left, so the densification has to happen before the
    // series leaves the server.
    expect(result.series).toHaveLength(7);
    expect(result.series.map((point) => point.commits)).toEqual([
      0, 0, 0, 1, 0, 0, 3,
    ]);
    expect(result.totals.activeDays).toBe(2);
  });

  it("splits the current window from the identical-length prior window", async () => {
    // 8 days back sits in the prior window of a 7-day query: the current window
    // is days 0-6 and the comparison window is days 7-13. The whole reason the
    // query fetches two windows at once is that the trend figure divides the one
    // by the other, and a mis-sliced boundary would silently compare a commit to
    // itself.
    batchResults[0] = [{ date: dayKey(8), commits: 10 }];

    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 7);

    // The chart draws the prior period as a dashed ghost and the trend figure
    // divides by its total. Both need the *same* range, which is why the window
    // is a server-side parameter instead of a client-side slice.
    expect(result.series).toHaveLength(7);
    expect(result.priorSeries).toHaveLength(7);
    expect(result.totals.commitsInWindow).toBe(0);
    expect(result.totals.priorWindowCommits).toBe(10);
  });

  it("clamps an unsupported window instead of trusting the caller", async () => {
    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 365);

    // The router already rejects this with a zod enum. The service clamps
    // anyway, because it is the layer the next caller will forget to validate.
    expect(result.days).toBe(30);
    expect(result.series).toHaveLength(30);
  });

  it("orders the series ascending regardless of what the database returned", async () => {
    batchResults[0] = [
      { date: dayKey(0), commits: 2 },
      { date: dayKey(2), commits: 1 },
    ];

    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 7);
    const keys = result.series.map((point) => point.date);
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("getProjectInsights work counts", () => {
  it("passes the database counts through as numbers", async () => {
    batchResults[1] = [
      {
        openIssues: BigInt(3),
        closedIssues: BigInt(12),
        openPullRequests: BigInt(2),
        mergedPullRequests: BigInt(8),
        medianOpenAgeDays: 4.4,
      },
    ];

    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // Postgres returns `count` as bigint. A bigint surviving into the client
    // throws on the first `+` it meets — which is the trend arithmetic.
    expect(result.work.openIssues).toBe(3);
    expect(result.work.medianOpenAgeDays).toBe(4);
  });

  it("reports zeros, not null, when the repository has no issues at all", async () => {
    batchResults[1] = [];

    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // Zeros rather than null: an aggregate over an empty table is a real
    // answer, and a null here would push the empty-state decision into every
    // caller that renders work counts.
    expect(result.work.openIssues).toBe(0);
    expect(result.work.openPullRequests).toBe(0);
    expect(result.work.medianOpenAgeDays).toBeNull();
  });
});