/**
 * A repository that is too large to index must be turned away before any
 * ingestion work starts.
 *
 * The per-file and per-repo caps only act once a tarball is already being
 * streamed — the download has happened and the worker's time is spent. GitHub
 * reports `diskUsage` in the metadata call that every project creation already
 * makes, so the decision can be made up front for free.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/** The GraphQL response the mocked octokit returns. */
let repoMetadata: Record<string, unknown> = {};

const writes: string[] = [];

vi.mock("@/src/lib/github/client", () => ({
  octokit: {
    graphql: async () => ({ repository: repoMetadata }),
    request: async () => ({ data: [] }),
  },
}));

vi.mock("@/db", () => ({
  db: {
    insert: () => {
      writes.push("insert");
      const b: Record<string, unknown> = {
        then: (r: (v: unknown) => unknown) => Promise.resolve([{ id: "p1" }]).then(r),
      };
      for (const m of ["values", "returning", "onConflictDoNothing"]) {
        b[m] = () => b;
      }
      return b;
    },
    update: () => {
      const b: Record<string, unknown> = {
        then: (r: (v: unknown) => unknown) => Promise.resolve([]).then(r),
      };
      for (const m of ["set", "where", "returning"]) b[m] = () => b;
      return b;
    },
  },
}));

vi.mock("@/src/lib/inngest/client", () => ({
  inngest: { send: async () => {} },
}));

import { createNewProject } from "@/src/lib/github/services/project";
import { GITHUB_CONFIG } from "@/src/lib/github/constants";

/** Minimal but structurally valid metadata payload. */
function metadata(diskUsage: number | null) {
  return {
    stargazerCount: 1,
    forkCount: 1,
    diskUsage,
    refs: { totalCount: 1 },
    mentionableUsers: { totalCount: 1 },
    languages: { edges: [] },
    defaultBranchRef: {
      target: {
        history: {
          totalCount: 1,
          nodes: [
            {
              oid: "abc",
              messageHeadline: "init",
              message: "init",
              author: null,
            },
          ],
        },
      },
    },
  };
}

const URL = "https://github.com/owner/repo";

beforeEach(() => {
  writes.length = 0;
  repoMetadata = metadata(1_000);
});

describe("repository size limit", () => {
  it("rejects a repository over the disk usage limit", async () => {
    repoMetadata = metadata(GITHUB_CONFIG.MAX_REPO_DISK_USAGE_KB + 1);

    await expect(createNewProject(URL, "name", "user_1")).rejects.toThrow(
      /too large/i,
    );
  });

  it("does not write a project row for a rejected repository", async () => {
    repoMetadata = metadata(GITHUB_CONFIG.MAX_REPO_DISK_USAGE_KB * 10);

    await createNewProject(URL, "name", "user_1").catch(() => undefined);

    expect(writes).not.toContain("insert");
  });

  it("accepts a repository at the limit", async () => {
    repoMetadata = metadata(GITHUB_CONFIG.MAX_REPO_DISK_USAGE_KB);

    await expect(
      createNewProject(URL, "name", "user_1"),
    ).resolves.toBeDefined();
  });

  it("accepts a repository when GitHub reports no disk usage", async () => {
    repoMetadata = metadata(null);

    await expect(
      createNewProject(URL, "name", "user_1"),
    ).resolves.toBeDefined();
  });
});
