/**
 * T-051: `getFileContent` must reject a malformed id at the edge, and
 * `createCommitData` must not swallow the shape of the GitHub payload.
 *
 * The first is a validation test. A bare `z.string()` lets a typo travel all
 * the way into a `where id = $1` that can never match, and the caller sees an
 * empty result rather than a rejected request — so the bug is invisible. The
 * siblings `getIssues` and `getIssueComments` already use `.uuid()`; this is
 * the last hole.
 *
 * The second is a typing fix. `createCommitData(commit: any, …)` silenced
 * eslint, which meant a GitHub field rename showed up as a runtime
 * `undefined` written into the database instead of a compile error.
 */

import { describe, it, expect, vi } from "vitest";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";

const FILE_ROW = { code: "print('hello')" };

// The db mock is async so it can import the real schema and compare table
// objects by identity -- drizzle tables are Proxies that throw on unknown
// property access, so there is no name to sniff.
vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");

  return {
    db: {
      select: () => {
        const thenable = (rows: unknown[]) => {
          const builder: Record<string, unknown> = {};
          const methods = [
            "from",
            "where",
            "limit",
            "orderBy",
            "leftJoin",
            "innerJoin",
            "set",
            "values",
            "returning",
          ];
          for (const m of methods) builder[m] = () => builder;
          builder.then = (resolve: (v: unknown[]) => void) => resolve(rows);
          return builder;
        };
        // getFileContent selects project_files.code. Any other table gets
        // nothing, so an unexpected query here shows up as an empty result
        // instead of passing by accident.
        return {
          from: (table: unknown) =>
            thenable(table === schema.projectFiles ? [FILE_ROW] : []),
        };
      },
    },
  };
});

vi.mock("@/src/lib/guards", () => ({
  assertProjectOwnership: vi.fn(async () => ({ id: PROJECT_ID, ownerId: "user_1" })),
}));

// projectService pulls its GitHub helpers from the barrel, and the barrel's
// client module throws on a missing GITHUB_TOKEN at import time. Mocking the
// barrel is the only way to import the service in a unit test.
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
import { createCommitData } from "@/src/lib/github/utils";

const createCaller = createCallerFactory(projectRouter);
const caller = createCaller({ userId: "user_1", req: undefined } as never);

describe("getFileContent input", () => {
  it("accepts a well-formed uuid pair", async () => {
    // The happy path must survive the tightened schema, otherwise the fix
    // would have broken the code viewer rather than secured it.
    await expect(
      caller.getFileContent({ projectId: PROJECT_ID, fileId: FILE_ID }),
    ).resolves.not.toThrow();
  });

  it.each([
    ["fileId", { projectId: PROJECT_ID, fileId: "not-a-uuid" }],
    ["fileId: empty", { projectId: PROJECT_ID, fileId: "" }],
    ["fileId: a number", { projectId: PROJECT_ID, fileId: 42 as never }],
    ["projectId", { projectId: "nope", fileId: FILE_ID }],
  ])("rejects a bad %s with a validation error", async (_label, input) => {
    await expect(caller.getFileContent(input)).rejects.toThrow(
      /invalid|uuid|expected/i,
    );
  });

  it("never reaches the database when the id is malformed", async () => {
    // The point of validating at the edge: no query is built at all, so a
    // bad id cannot become a `where id = $1` that silently matches nothing.
    const { db } = await import("@/db");
    const select = vi.spyOn(db, "select");

    await expect(
      caller.getFileContent({ projectId: PROJECT_ID, fileId: "../../etc" }),
    ).rejects.toThrow();

    expect(select).not.toHaveBeenCalled();
    select.mockRestore();
  });
});

describe("createCommitData", () => {
  it("maps the GitHub payload onto the database shape", () => {
    const result = createCommitData(
      {
        sha: "abc123",
        author: { avatar_url: "https://example.test/a.png" },
        commit: {
          message: "fix: something",
          author: {
            name: "Ada",
            email: "ada@example.test",
            date: "2026-01-01T00:00:00Z",
          },
          committer: {
            name: "Grace",
            email: "grace@example.test",
            date: "2026-01-02T00:00:00Z",
          },
        },
      },
      PROJECT_ID,
    );

    expect(result).toMatchObject({
      commitHash: "abc123",
      commitMessage: "fix: something",
      authorName: "Ada",
      authorAvatar: "https://example.test/a.png",
      authorEmail: "ada@example.test",
      committerName: "Grace",
      committerEmail: "grace@example.test",
      projectId: PROJECT_ID,
    });
    expect(result.authorDate).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(result.committerDate).toEqual(new Date("2026-01-02T00:00:00Z"));
  });

  it("falls back to defaults when the author metadata is absent", () => {
    // GitHub omits commit.author for unlinked commits, so the narrow type has
    // to keep these optional -- the fallbacks are the whole point.
    const result = createCommitData({ sha: "def456", commit: {} }, PROJECT_ID);

    expect(result.commitMessage).toBe("");
    expect(result.authorName).not.toBe("");
    expect(result.authorAvatar).not.toBe("");
    expect(result.authorEmail).not.toBe("");
  });
});
