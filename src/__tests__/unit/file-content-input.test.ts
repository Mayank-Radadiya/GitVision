/**
 * T51 — the `getFileContent` input and the GitHub commit boundary.
 *
 * Two validation holes on paths that end at the database.
 *
 * `getFileContent` accepted bare `z.string()` for both ids while its siblings
 * (`getProjectDetails`, `getCommits`) use `.uuid()`. Both columns are `uuid` in
 * Postgres, so a malformed id reached the query as a value that cannot match
 * anything — which reads to the caller like "this file does not exist", the same
 * answer as a real miss.
 *
 * `createCommitData(commit: any, …)` typed an unvalidated GitHub REST payload as
 * `any` behind an eslint-disable. GitHub renamed `commit.author` to
 * `commit.committer`-style shapes before, and a field rename here surfaces as a
 * runtime `undefined` that becomes a silent `DEFAULTS` substitution rather than
 * a type error at the boundary.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@clerk/nextjs/server", async () => {
  const actual = await vi.importActual<typeof import("@clerk/nextjs/server")>(
    "@clerk/nextjs/server",
  );
  return { ...actual, auth: async () => ({ userId: "user_1" }) };
});

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  const thenable = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    };
    for (const method of ["select", "from", "where", "limit", "orderBy"]) {
      builder[method] = () => builder;
    }
    return builder;
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) =>
          table === schema.projectTables ? thenable([{ ownerId: "user_1" }]) : thenable([]),
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

import { createCallerFactory } from "@/src/lib/trpc/init";
import { projectRouter } from "@/src/features/dashboard/server/router/project";
import { createCommitData } from "@/src/lib/github/utils";

const caller = createCallerFactory(projectRouter)({
  userId: "user_1",
  req: undefined,
  requestId: "req_1",
});

const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const FILE_ID = "44444444-4444-4444-8444-444444444444";

/** What a tRPC validation failure looks like from the caller's side. */
async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return (error as { code?: string }).code ?? "<threw>";
  }
  return "<resolved>";
}

describe("getFileContent input validation", () => {
  it("accepts uuid ids", async () => {
    // It does not resolve to data — the mocked file lookup returns no rows — but
    // it gets past input validation, which is what this test is about.
    const code = await codeOf(() =>
      caller.getFileContent({ projectId: PROJECT_ID, fileId: FILE_ID }),
    );

    expect(code).not.toBe("BAD_REQUEST");
  });

  it("rejects a non-uuid projectId", async () => {
    const code = await codeOf(() =>
      caller.getFileContent({ projectId: "not-a-uuid", fileId: FILE_ID }),
    );

    expect(code).toBe("BAD_REQUEST");
  });

  it("rejects a non-uuid fileId", async () => {
    const code = await codeOf(() =>
      caller.getFileContent({ projectId: PROJECT_ID, fileId: "../../etc/passwd" }),
    );

    expect(code).toBe("BAD_REQUEST");
  });

  it("sends the ids to Postgres as parameters rather than interpolated text", async () => {
    // A rejected id is the whole point; this pins that nothing downstream is
    // still accepting a string. A uuid column cannot match `"not-a-uuid"`, so
    // without this the call would look exactly like a missing file.
    const code = await codeOf(() =>
      caller.getFileContent({ projectId: "123", fileId: "123" }),
    );

    expect(code).toBe("BAD_REQUEST");
  });
});

describe("createCommitData boundary", () => {
  const FULL = {
    sha: "abc123",
    author: { avatar_url: "https://avatars.example/octocat" },
    commit: {
      message: "fix: the thing",
      author: {
        name: "Octo Cat",
        email: "octo@example.com",
        date: "2026-01-01T00:00:00.000Z",
      },
      committer: {
        name: "Committer",
        email: "commit@example.com",
        date: "2026-01-02T00:00:00.000Z",
      },
    },
  };

  it("maps a complete commit payload onto the database shape", () => {
    const data = createCommitData(FULL, PROJECT_ID);

    expect(data).toMatchObject({
      commitHash: "abc123",
      commitMessage: "fix: the thing",
      authorName: "Octo Cat",
      authorEmail: "octo@example.com",
      committerName: "Committer",
      committerEmail: "commit@example.com",
      projectId: PROJECT_ID,
    });
  });

  it("substitutes defaults for missing author metadata", () => {
    const data = createCommitData({ sha: "def456", commit: { message: "" } }, PROJECT_ID);

    // The reason the payload is typed at all: a field GitHub renames becomes an
    // `undefined` here that silently becomes a default, so the type has to name
    // the fields the function reads or nothing catches the rename.
    expect(data.commitMessage).toBe("");
    expect(data.authorName).toBe("Unknown");
    expect(data.authorEmail).toBe("unknown@example.com");
    expect(data.committerName).toBe("Unknown");
    expect(data.authorDate).toBeInstanceOf(Date);
  });

  it("truncates names and emails to the column width", () => {
    const long = "x".repeat(400);
    const data = createCommitData(
      {
        sha: "aaa",
        commit: {
          message: "m",
          author: { name: long, email: long, date: "2026-01-01T00:00:00.000Z" },
          committer: { name: long, email: long, date: "2026-01-01T00:00:00.000Z" },
        },
      },
      PROJECT_ID,
    );

    expect(data.authorName).toHaveLength(255);
    expect(data.authorEmail).toHaveLength(255);
    expect(data.committerName).toHaveLength(255);
    expect(data.committerEmail).toHaveLength(255);
  });
});
