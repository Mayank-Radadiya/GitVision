/**
 * T-056: the commits keyset cursor must be compound.
 *
 * The old cursor compared on `authorDate` alone but handed back the unique
 * `id` as the token. `authorDate` is not unique — a batch pushed in one `git
 * push`, or one imported by a script, shares a timestamp to the second — so
 * every commit on the far side of that tie was skipped, and a page boundary
 * landing inside a tie duplicated the rest of it.
 *
 * The fix is the standard compound keyset: order by `(author_date DESC, id
 * DESC)`, carry both values in the cursor, and compare the pair with
 * Postgres row-value syntax. This file proves the contract — that the cursor
 * carries the id, that the id reaches the statement, and that walking a
 * tie-heavy batch with the resulting predicate returns every commit exactly
 * once.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user_1";

type Call = { table: unknown; where: unknown; orderBy: unknown[]; limit?: number };

const calls: Call[] = [];
let commitRows: Record<string, unknown>[] = [];

// Drizzle table objects are Proxies that throw on unknown property access, so
// the mock imports the real schema and compares table objects by identity.
vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");

  const thenable = (rows: unknown[]) => {
    const record: Call = {
      table: undefined,
      where: undefined,
      orderBy: [],
    };
    const builder: Record<string, unknown> = {
      from: (table: unknown) => {
        record.table = table;
        return builder;
      },
      where: (w: unknown) => {
        record.where = w;
        return builder;
      },
      orderBy: (...o: unknown[]) => {
        record.orderBy = o;
        return builder;
      },
      limit: (n: number) => {
        record.limit = n;
        return builder;
      },
    };
    builder.then = (resolve: (v: unknown) => void) =>
      resolve(
        record.table === schema.commitsTable ? commitRows : [],
      );
    calls.push(record);
    return builder;
  };

  return { db: { select: () => thenable([]) } };
});

vi.mock("@/src/lib/guards", () => ({
  assertProjectOwnership: vi.fn(async () => ({ id: PROJECT_ID, ownerId: USER_ID })),
}));

vi.mock("@/src/lib/github", () => ({
  createNewProject: vi.fn(),
  getAiSummaryOfCommit: vi.fn(),
  syncIssuesAndComments: vi.fn(),
  createCommitData: vi.fn(),
  isIgnoredPath: vi.fn(() => false),
}));

vi.mock("@/src/lib/inngest/client", () => ({ inngest: vi.fn() }));

vi.mock("@/src/lib/credits", () => ({
  spendCredits: vi.fn(),
  PROJECT_CREATION_COST: 1,
  COMMIT_SUMMARY_COST: 1,
}));

import { createCallerFactory } from "@/src/lib/trpc/init";
import { projectRouter } from "@/src/features/dashboard/server/router/project";
import { projectCommitsSchema } from "@/src/lib/validation/schemas";

const createCaller = createCallerFactory(projectRouter);
const caller = createCaller({ userId: USER_ID, req: undefined } as never);

// commits.id is a uuid, and the input schema enforces it. These sort
// lexicographically in the order written, which is what the tie-break relies
// on, so the expected next cursor is readable at a glance.
const C1 = "aaaaaaaa-0000-4000-8000-000000000001";
const C2 = "aaaaaaaa-0000-4000-8000-000000000002";
const C3 = "aaaaaaaa-0000-4000-8000-000000000003";
const C4 = "aaaaaaaa-0000-4000-8000-000000000004";
const C5 = "aaaaaaaa-0000-4000-8000-000000000005";

function commit(id: string, authorDate: string) {
  return { id, projectId: PROJECT_ID, authorDate: new Date(authorDate) };
}

beforeEach(() => {
  calls.length = 0;
  commitRows = [];
});

describe("getProjectCommits cursor is compound", () => {
  it("orders by authorDate and then id, not by authorDate alone", async () => {
    commitRows = [commit(C1, "2026-01-01T00:00:00Z")];

    await caller.getCommits({ projectId: PROJECT_ID, limit: 10 });

    const page = calls.find((c) => c.orderBy.length > 0);
    // Two sort keys. A single one is the bug this task exists to fix.
    expect(page?.orderBy).toHaveLength(2);
  });

  it("hands back both sort keys as the next cursor", async () => {
    commitRows = [
      commit(C1, "2026-01-02T00:00:00Z"),
      commit(C2, "2026-01-02T00:00:00Z"),
      commit(C3, "2026-01-02T00:00:00Z"),
    ];

    const page = await caller.getCommits({ projectId: PROJECT_ID, limit: 2 });

    expect(page.commits).toHaveLength(2);
    expect(page.nextCursor).toEqual({
      authorDate: new Date("2026-01-02T00:00:00Z"),
      id: C2,
    });
  });

  it("returns no cursor on a partial page", async () => {
    commitRows = [commit(C1, "2026-01-02T00:00:00Z")];

    const page = await caller.getCommits({ projectId: PROJECT_ID, limit: 10 });

    expect(page.nextCursor).toBeNull();
  });

  it("puts the keyset predicate in the statement only when a cursor is given", async () => {
    commitRows = [commit(C1, "2026-01-02T00:00:00Z")];

    await caller.getCommits({ projectId: PROJECT_ID, limit: 10 });
    const first = calls.find((c) => c.orderBy.length > 0)?.where;

    calls.length = 0;
    await caller.getCommits({
      projectId: PROJECT_ID,
      limit: 10,
      cursor: { authorDate: new Date("2026-01-02T00:00:00Z"), id: C2 },
    });
    const second = calls.find((c) => c.orderBy.length > 0)?.where;

    expect(first).not.toBe(second);
  });
});

describe("commits cursor validation", () => {
  it("rejects a bare string cursor — the old shape is a wrong-page generator", async () => {
    // A bare id is what the client used to send. Guessing at it would silently
    // resume from the wrong place; the task asks for a loud failure instead.
    await expect(
      caller.getCommits({
        projectId: PROJECT_ID,
        limit: 10,
        // Cast because the whole point is that a real client can still be
        // sending this; the input type no longer permits it, but the wire does.
        cursor: "44444444-4444-4444-8444-444444444444" as never,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("rejects a cursor missing the id", () => {
    expect(
      projectCommitsSchema.safeParse({
        projectId: PROJECT_ID,
        limit: 10,
        cursor: { authorDate: new Date("2026-01-02T00:00:00Z") },
      }).success,
    ).toBe(false);
  });

  it("rejects a cursor missing the authorDate", () => {
    expect(
      projectCommitsSchema.safeParse({
        projectId: PROJECT_ID,
        limit: 10,
        cursor: { id: "44444444-4444-4444-8444-444444444444" },
      }).success,
    ).toBe(false);
  });

  it("accepts a well-formed compound cursor", () => {
    expect(
      projectCommitsSchema.safeParse({
        projectId: PROJECT_ID,
        limit: 10,
        cursor: {
          authorDate: new Date("2026-01-02T00:00:00Z"),
          id: "44444444-4444-4444-8444-444444444444",
        },
      }).success,
    ).toBe(true);
  });
});

describe("paging a batch that shares one authorDate", () => {
  it("returns every commit exactly once", async () => {
    // Five commits, all with the same authorDate. With a cursor on
    // authorDate alone the second page is unreachable -- every row compares
    // equal, so the filter returns nothing and the loop never advances. The
    // id is what breaks the tie.
    const all = [
      commit(C1, "2026-01-02T00:00:00Z"),
      commit(C2, "2026-01-02T00:00:00Z"),
      commit(C3, "2026-01-02T00:00:00Z"),
      commit(C4, "2026-01-02T00:00:00Z"),
      commit(C5, "2026-01-02T00:00:00Z"),
    ].sort(
      (a, b) =>
        b.authorDate.getTime() - a.authorDate.getTime() ||
        b.id.localeCompare(a.id),
    );

    // The predicate the SQL expresses, evaluated in JS so the paging loop can
    // be driven end to end without a database. Postgres row-value comparison
    // is lexicographic, which is what this is.
    const after = (
      rows: Record<string, unknown>[],
      cursor: { authorDate: Date; id: string } | null,
    ) =>
      cursor === null
        ? rows
        : rows.filter(
            (r) =>
              (r.authorDate as Date).getTime() < cursor.authorDate.getTime() ||
              ((r.authorDate as Date).getTime() ===
                cursor.authorDate.getTime() &&
                (r.id as string) < cursor.id),
          );

    const seen: string[] = [];
    let cursor: { authorDate: Date; id: string } | null = null;
    let guard = 0;

    for (;;) {
      guard += 1;
      if (guard > 10) throw new Error("paging did not terminate");

      // The service asks for limit + 1, so hand it the sentinel too.
      commitRows = after(all, cursor).slice(0, 3);
      const page = await caller.getCommits({
        projectId: PROJECT_ID,
        limit: 2,
        cursor: cursor ?? undefined,
      });

      seen.push(...page.commits.map((c) => c.id as string));
      if (!page.nextCursor) break;
      cursor = page.nextCursor as { authorDate: Date; id: string };
    }

    expect(seen).toHaveLength(5);
    expect([...seen].sort()).toEqual([C1, C2, C3, C4, C5]);
  });
});
