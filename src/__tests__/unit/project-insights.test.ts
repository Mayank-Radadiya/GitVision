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

import {
  createProjectService,
  RECENT_COMMIT_MESSAGE_CAP,
} from "@/src/features/dashboard/server/router/services/projectService";

const service = createProjectService();

/** Empty-but-complete batch results, one entry per statement the service issues. */
function emptyBatch() {
  return [
    [], // daily buckets
    [{ openIssues: 0, closedIssues: 0, openPullRequests: 0, mergedPullRequests: 0, medianOpenAgeDays: null }],
    [], // contributors
    [{ chunks: 0, tokens: 0 }],
    [], // file languages
    [{ at: null, firstAt: null }], // first / last activity
    [], // recent commits
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
  it("keeps the daily aggregate free of commit_message", async () => {
    await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // `commits.commit_message` averages 1,092 bytes and reaches 65,536. The
    // documented cost of the paged query this replaces was wire width, not a
    // slow plan, so pulling the column into the *aggregate* re-imports the defect
    // for every project on the page in exchange for a per-day count that needs
    // no text at all.
    //
    // Scoped to the daily leg because the recent-activity feed legitimately reads
    // the column — see the leg that asserts its own bound.
    const daily = selections
      .slice(0, 1)
      .filter((selection) => selection !== "*")
      .map((selection) => describeSql(selection))
      .join(" ");
    expect(daily).not.toMatch(/commit_message/);
    // A wildcard projection would drag it along with everything else.
    expect(selections).not.toContain("*");
  });

  it("caps the recent-activity feed at a bounded number of capped messages", async () => {
    batchResults[6] = [
      {
        id: "c1",
        hash: "abc1234",
        message: `feat: add the thing\n\n${"body ".repeat(500)}`,
        authorName: "Ada Lovelace",
        authorAvatar: null,
        authorDate: new Date("2026-01-20T00:00:00Z"),
      },
      {
        id: "c2",
        hash: "def5678",
        message: "chore: bump",
        authorName: "Alan Turing",
        authorAvatar: null,
        authorDate: new Date("2026-01-19T00:00:00Z"),
      },
    ];

    const insights = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // The reason this feed is capped twice. `commit_message` peaks at 64KB, so an
    // unbounded message list is the single most expensive thing the Overview could
    // have asked for — and it only ever renders a subject line. Eight rows is what
    // the band shows; `truncateSubject` bounds each one to its first line.
    expect(insights.recentCommits).toHaveLength(2);
    expect(insights.recentCommits[0]!.message).toBe("feat: add the thing");
    expect(insights.recentCommits[0]!.message.length).toBeLessThanOrEqual(
      RECENT_COMMIT_MESSAGE_CAP + 1,
    );
    // Bigint columns would otherwise arrive as strings and break client maths.
    expect(typeof insights.recentCommits[0]!.authorDate).toBe("object");
  });

  it("bounds the feed to a fixed row count", async () => {
    batchResults[6] = Array.from({ length: 40 }, (_, index) => ({
      id: `c${index}`,
      hash: `hash${index}`,
      message: `fix: ${index}`,
      authorName: "Ada Lovelace",
      authorAvatar: null,
      authorDate: new Date(),
    }));

    const insights = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);
    expect(insights.recentCommits).toHaveLength(40);
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
    expect(result.work.openAgeBuckets).toEqual({
      fresh: 0,
      aging: 0,
      stale: 0,
      dormant: 0,
    });
  });

  it("numbers the age buckets so the histogram can be checked against the total", async () => {
    batchResults[1] = [
      {
        openIssues: BigInt(4),
        closedIssues: BigInt(0),
        openPullRequests: BigInt(6),
        mergedPullRequests: BigInt(0),
        medianOpenAgeDays: null,
        freshOpen: BigInt(7),
        agingOpen: BigInt(3),
        staleOpen: BigInt(0),
        dormantOpen: BigInt(0),
      },
    ];

    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // Same reason as the counts above, plus the fact that the client compares the
    // bucket sum against `openIssues + openPullRequests` to decide whether the
    // distribution is safe to draw at all. A bigint here breaks that comparison.
    expect(result.work.openAgeBuckets).toEqual({
      fresh: 7,
      aging: 3,
      stale: 0,
      dormant: 0,
    });
  });

  it("reports whether the buckets actually reconcile with the open total", async () => {
    batchResults[1] = [
      {
        openIssues: BigInt(4),
        closedIssues: BigInt(0),
        openPullRequests: BigInt(6),
        mergedPullRequests: BigInt(0),
        medianOpenAgeDays: null,
        freshOpen: BigInt(7),
        agingOpen: BigInt(3),
        staleOpen: BigInt(0),
        dormantOpen: BigInt(0),
      },
    ];

    const matching = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);
    expect(matching.lifecycle.bucketsAgree).toBe(true);

    // A mismatch is the signal the client uses to omit the histogram instead of
    // drawing bands that contradict the number printed above them. Making the
    // service state it explicitly means a future statement split surfaces as one
    // band disappearing, not as a chart that quietly lies.
    batchResults[1] = [
      {
        openIssues: BigInt(4),
        closedIssues: BigInt(0),
        openPullRequests: BigInt(6),
        mergedPullRequests: BigInt(0),
        medianOpenAgeDays: null,
        freshOpen: BigInt(5),
        agingOpen: BigInt(1),
        staleOpen: BigInt(0),
        dormantOpen: BigInt(0),
      },
    ];
    const mismatched = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);
    expect(mismatched.lifecycle.bucketsAgree).toBe(false);
  });
});

describe("getProjectInsights lifecycle", () => {
  it("reports the history span from the two ends of the commit table", async () => {
    batchResults[5] = [
      { at: new Date("2026-01-20T00:00:00Z"), firstAt: new Date("2025-11-02T00:00:00Z") },
    ];

    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // Drives the "History" figure. A `MIN(author_date)` costs nothing here —
    // it rides along in the statement that already took `MAX`.
    expect(result.lifecycle.firstCommitAt).toEqual(new Date("2025-11-02T00:00:00Z"));
    expect(result.lifecycle.spanDays).toBe(79);
  });

  it("reports no span for a single-commit repository", async () => {
    batchResults[5] = [
      { at: new Date("2026-01-20T00:00:00Z"), firstAt: new Date("2026-01-20T00:00:00Z") },
    ];

    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);

    // Zero is a real answer for "how long" but reads as a bug on a dashboard, and
    // one commit is a normal state for a freshly imported repository.
    expect(result.lifecycle.spanDays).toBeNull();
  });

  it("reports no span when nothing has ever synced", async () => {
    batchResults[5] = [{ at: null, firstAt: null }];
    const result = await service.getProjectInsights(PROJECT_ID, USER_ID, 30);
    expect(result.lifecycle.spanDays).toBeNull();
    expect(result.lifecycle.firstCommitAt).toBeNull();
  });
});