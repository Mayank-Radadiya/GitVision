/**
 * T-015 — tar entry names must be sanitised, not just de-prefixed.
 *
 * The streamer strips exactly one leading segment (`owner-repo-sha/src/a.ts` →
 * `src/a.ts`) and stores the remainder verbatim. Stripping one segment is not
 * sanitisation: `repo/../../etc/passwd` and `repo/src/../../secret.ts` both
 * survive with a `..` segment intact. There is no filesystem write, so this is
 * not a traversal *write* — but the name is persisted, rendered in the file
 * tree, and re-emitted as a RAG citation, which is an attacker-controlled path
 * into the AI's context.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as tar from "tar-stream";
import type { Headers } from "tar-stream";
import { gzipSync } from "zlib";
import { Readable } from "stream";

/** Rows handed to `db.insert(projectFiles)`, across every batch flush. */
let inserted: { fileName: string; code: string }[] = [];
/** The `totalFiles` count written back to the project row. */
let totalFilesWritten: number | null = null;

const chain = () => {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
  };
  for (const method of [
    "select",
    "from",
    "where",
    "limit",
    "orderBy",
    "values",
    "returning",
    "insert",
    "delete",
  ]) {
    builder[method] = () => builder;
  }
  builder.set = (payload: Record<string, unknown>) => {
    if (typeof payload.totalFiles === "number") totalFilesWritten = payload.totalFiles;
    return builder;
  };
  return builder;
};

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => chain() }),
    update: () => chain(),
    delete: () => chain(),
    insert: () => ({
      values: (rows: { fileName: string; code: string }[]) => {
        inserted.push(...rows);
        return chain();
      },
    }),
  },
}));

let tarball = Buffer.alloc(0);

vi.mock("axios", () => ({
  default: async () => ({ data: Readable.from([tarball]) }),
}));

import { getRepositoryFiles } from "@/src/lib/github/services/files";

/** Builds a gzipped tarball from `[name, body]` pairs. */
async function buildTarball(entries: { name: string; body: string; type?: Headers["type"]; linkname?: string }[]) {
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  const done = new Promise<void>((resolve) => {
    pack.on("data", (chunk: Buffer) => chunks.push(chunk));
    pack.on("end", () => resolve());
  });
  for (const entry of entries) {
    pack.entry(
      { name: entry.name, type: entry.type ?? "file", linkname: entry.linkname },
      entry.body,
    );
  }
  pack.finalize();
  await done;
  return gzipSync(Buffer.concat(chunks));
}

beforeEach(() => {
  inserted = [];
  totalFilesWritten = null;
});

describe("tarball entry names", () => {
  it("stores ordinary files with the leading segment stripped", async () => {
    tarball = await buildTarball([
      { name: "repo-abc123/src/index.ts", body: "export const a = 1;" },
      { name: "repo-abc123/README.md", body: "# hello" },
    ]);

    const stored = await getRepositoryFiles("owner", "repo", "project-1");

    expect(inserted.map((row) => row.fileName).sort()).toEqual([
      "README.md",
      "src/index.ts",
    ]);
    expect(stored).toBe(2);
    expect(totalFilesWritten).toBe(2);
  });

  it("drops an entry that climbs out of the archive root", async () => {
    tarball = await buildTarball([
      { name: "repo-abc123/../../etc/passwd", body: "root:x:0:0" },
    ]);

    await getRepositoryFiles("owner", "repo", "project-1");

    expect(inserted).toHaveLength(0);
    expect(totalFilesWritten).toBe(0);
  });

  it("drops an entry whose interior segment escapes", async () => {
    tarball = await buildTarball([
      { name: "repo-abc123/src/../../secrets.env", body: "TOKEN=abc" },
      { name: "repo-abc123/src/ok.ts", body: "export const ok = true;" },
    ]);

    await getRepositoryFiles("owner", "repo", "project-1");

    expect(inserted.map((row) => row.fileName)).toEqual(["src/ok.ts"]);
  });

  it("never stores a name containing a parent-directory segment", async () => {
    tarball = await buildTarball([
      { name: "repo-abc123/a/../../b.ts", body: "x" },
      { name: "repo-abc123/../b.ts", body: "x" },
      { name: "repo-abc123/c/./d.ts", body: "x" },
    ]);

    await getRepositoryFiles("owner", "repo", "project-1");

    for (const row of inserted) {
      expect(row.fileName.split("/")).not.toContain("..");
    }
  });

  it("does not store symlinks or hard links", async () => {
    tarball = await buildTarball([
      { name: "repo-abc123/link.ts", type: "symlink", linkname: "/etc/passwd", body: "" },
      { name: "repo-abc123/hard.ts", type: "link", linkname: "repo-abc123/a.ts", body: "" },
    ]);

    await getRepositoryFiles("owner", "repo", "project-1");

    expect(inserted).toHaveLength(0);
  });
});
