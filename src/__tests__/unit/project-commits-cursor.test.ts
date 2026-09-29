/**
 * T56 — the commit cursor must carry both halves of the sort key.
 *
 * The cursor used to be a bare commit `id`. The service looked that row up,
 * took its `authorDate`, and asked for `authorDate < cursorDate`. Two problems
 * followed from that:
 *
 *   1. `authorDate` is not unique. A rebase lands a dozen commits on one
 *      timestamp, and a page boundary inside that run made every remaining tie
 *      invisible — `authorDate < cursorDate` skips the whole run at once. Rows
 *      were dropped, silently, from the middle of the history.
 *   2. The lookup was a second query that could resolve to nothing — a cursor
 *      for a deleted commit silently produced the *first* page again, which
 *      reads as a working pager and is actually a loop.
 *
 * The fix is a compound keyset on `(author_date, id)`, which is the sort key,
 * and no lookup at all: the cursor carries the date.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

/** Commits the mocked lookup returns. */
let commitRows: unknown[] = [];
/** Projects the caller owns, per the mocked `projects` table. */
let projectRows: unknown[] = [];
/** Every `limit(n)` the mocked builder was asked for, in call order. */
let limits: number[] = [];
/** The predicates each query was asked to apply, flattened to strings. */
let predicates: string[] = [];
/** The columns each query was asked to order by, flattened to strings. */
let orderings: string[] = [];

/**
 * Flattens a Drizzle SQL fragment to text.
 *
 * A condition is a tree of `queryChunks`: bound values carry `.value`, column
 * references carry `.name`, and `and()`/`or()` nest their operands as further
 * SQL objects. `String(fragment)` would yield `[object Object]` and every
 * assertion below would pass on nothing.
 */
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
      // The keyset predicate is not at the top level of the outer `where`.
      const nested = (chunk as { queryChunks?: unknown[] })?.queryChunks;
      if (Array.isArray(nested)) return describeSql(chunk);
      return "";
    })
    .join(" ");
}

/** Chainable no-op query builder; `then` resolves to `rows`.
 *
 * `limit` is honoured. The +1 over-fetch is how `nextCursor` is decided, and a
 * mock that ignored it would hand back every row and make the paging
 * assertions below pass for a service that never paged at all.
 */
function chain(rows: unknown[] = []) {
  const builder: Record<string, unknown> = {
    capped: Number.POSITIVE_INFINITY,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(rows.slice(0, builder.capped as number) as unknown[]).then(
        resolve,
      ),
  };
  for (const method of [
    "select",
    "from",
    "leftJoin",
    "innerJoin",
    "set",
    "values",
    "returning",
    "insert",
    "update",
    "delete",
  ]) {
    builder[method] = () => builder;
  }
  builder.where = (...conditions: unknown[]) => {
    predicates.push(...conditions.map(describeSql));
    return builder;
  };
  builder.orderBy = (...columns: unknown[]) => {
    orderings.push(...columns.map(describeSql));
    return builder;
  };
  builder.limit = (n: number) => {
    limits.push(n);
    builder.capped = Math.min(builder.capped as number, n);
    return builder;
  };
  return builder;
}

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.projectTables) return chain(projectRows);
          if (table === schema.commitsTable) return chain(commitRows);
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

beforeEach(() => {
  commitRows = [];
  projectRows = [{ ownerId: "user_1" }];
  limits = [];
  predicates = [];
  orderings = [];
});

const AT = new Date("2026-03-01T00:00:00.000Z");

/** `count` commits, newest first, all sharing one `authorDate`.
 *
 * A single shared timestamp is the shape that used to lose rows: any page
 * boundary inside the run dropped everything after it.
 */
function tiedCommits(count: number, authorDate: Date = AT) {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${String(i).padStart(3, "0")}`,
    commitMessage: `fix: thing ${i}`,
    authorName: "octocat",
    authorAvatar: null,
    authorDate,
    projectId: PROJECT_ID,
  }));
}

describe("getProjectCommits keyset", () => {
  it("orders by authorDate and then by id", async () => {
    commitRows = tiedCommits(3);

    await service.getProjectCommits(PROJECT_ID, "user_1", 10);

    // The tiebreak is the whole fix. Without it the order of equal timestamps
    // is whatever the planner feels like, and the cursor cannot name a
    // position inside the run.
    expect(orderings.join(" ")).toMatch(/author_date/);
    expect(orderings.join(" ")).toMatch(/\bid\b/);
  });

  it("compares the pair, not the timestamp alone", async () => {
    commitRows = tiedCommits(5);

    await service.getProjectCommits(
      PROJECT_ID,
      "user_1",
      10,
      `${AT.toISOString()}|c002`,
    );

    // A bare `author_date < …` cannot see the id, so every remaining row of a
    // tied run is invisible. The predicate has to name both columns.
    const commitsQuery = predicates[predicates.length - 1];
    expect(commitsQuery).toMatch(/author_date/);
    expect(commitsQuery).toMatch(/c002/);
  });

  it("returns each commit of a tied run exactly once", async () => {
    const all = tiedCommits(12);
    commitRows = all;

    const seen: string[] = [];
    for (let page = 0; page < 3; page++) {
      const result = await service.getProjectCommits(
        PROJECT_ID,
        "user_1",
        5,
        seen.length ? `${AT.toISOString()}|${seen[seen.length - 1]}` : undefined,
      );
      seen.push(...result.commits.map((c) => c.id));
      if (!result.nextCursor) break;
      // A builder is not a database: it cannot evaluate the keyset predicate,
      // so the window is narrowed here. What this proves is the *contract* —
      // the cursor names the last row returned, not the overflow row held
      // back, which is the difference between reaching all 12 and repeating
      // or losing one per page.
      const lastId = result.nextCursor.split("|")[1];
      const after = all.findIndex((c) => c.id === lastId) + 1;
      expect(after).toBeGreaterThan(0);
      commitRows = all.slice(after);
    }

    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
  });

  it("names the last row it returned, not the overflow row", async () => {
    commitRows = tiedCommits(6);

    const page = await service.getProjectCommits(PROJECT_ID, "user_1", 5);

    expect(page.commits).toHaveLength(5);
    // The 6th row was fetched only to prove there is a 6th. Handing it back as
    // the cursor would skip it on the next page.
    expect(page.nextCursor).toContain("c004");
    expect(page.nextCursor).not.toContain("c005");
  });

  it("carries the timestamp as well as the id", async () => {
    commitRows = tiedCommits(3);

    const page = await service.getProjectCommits(PROJECT_ID, "user_1", 2);

    expect(page.nextCursor).toBe(`${AT.toISOString()}|c001`);
  });

  it("does not look the cursor up in a second query", async () => {
    commitRows = tiedCommits(3);

    await service.getProjectCommits(
      PROJECT_ID,
      "user_1",
      2,
      `${AT.toISOString()}|c000`,
    );

    // The old cursor was a bare id, so the service had to resolve it to a date.
    // That lookup is what silently produced the first page again when the id
    // resolved to nothing. Two `limit`s means it is back.
    expect(limits).toEqual([1, 3]);
  });

  it("keeps the cursor in the same statement as the project filter", async () => {
    commitRows = tiedCommits(3);

    await service.getProjectCommits(
      PROJECT_ID,
      "user_1",
      2,
      `${AT.toISOString()}|c000`,
    );

    // One `where` carries the project and the cursor together. A second
    // statement for the cursor's page would let a caller walk another tenant's
    // commits with a guessed position.
    expect(predicates).toHaveLength(2);
    expect(predicates[0]).toMatch(/owner_id/);
    expect(predicates[1]).toMatch(/project_id/);
  });

  it("rejects a legacy id-only cursor instead of paging wrongly", async () => {
    commitRows = tiedCommits(3);

    // A cursor saved before this change is a bare uuid. It has no date, so
    // there is no honest position to resume from — returning the first page
    // again would look like a working pager looping forever.
    await expect(
      service.getProjectCommits(PROJECT_ID, "user_1", 2, "c000"),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a cursor whose date is not a date", async () => {
    commitRows = tiedCommits(3);

    await expect(
      service.getProjectCommits(PROJECT_ID, "user_1", 2, "nonsense|c000"),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("reports no cursor when the last page is not full", async () => {
    commitRows = tiedCommits(2);

    const page = await service.getProjectCommits(PROJECT_ID, "user_1", 10);

    expect(page.commits).toHaveLength(2);
    expect(page.nextCursor).toBeUndefined();
  });

  it("still refuses a project the caller does not own", async () => {
    projectRows = [];

    await expect(
      service.getProjectCommits(PROJECT_ID, "user_1", 10, `${AT.toISOString()}|c000`),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // The commit query never runs, so no cursor can be used to probe one.
    expect(limits).toEqual([1]);
  });
});

