import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import * as tar from "tar-stream";

/**
 * F-14 — incremental re-sync.
 *
 * These build a real .tar.gz in memory rather than mocking the extractor, so
 * the hash diff, the traversal guard and the prune decision are exercised
 * against actual tar-stream output instead of against assertions about mocks.
 */

// ── db mock ────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

// Terminal results for every awaited select, in order.
let results: Row[][] = [];
// `.set()` payloads, in order — the UPDATE writes the functions make.
let updates: Record<string, unknown>[] = [];
// Every `.limit(n)`, in order — the batch caps under test.
let limits: number[] = [];
// Every `insert().values()` payload plus whether the conflict clause was used.
let inserts: { values: Row[]; onConflict: boolean }[] = [];
// Every `delete()` call, for the prune assertions.
let deletes: number = 0;

function chain() {
  let expectsRows = true;
  let sawConflict = false;
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(expectsRows ? (results.shift() ?? []) : []).then(resolve),
  };
  for (const method of ["select", "from", "where", "orderBy", "insert", "delete"]) {
    builder[method] = () => builder;
  }
  builder.limit = (n: number) => {
    limits.push(n);
    return builder;
  };
  builder.returning = () => {
    expectsRows = true;
    return builder;
  };
  builder.set = (payload: Record<string, unknown>) => {
    updates.push(payload);
    expectsRows = false;
    return builder;
  };
  builder.values = (values: Row[]) => {
    inserts.push({ values, onConflict: sawConflict });
    expectsRows = false;
    return builder;
  };
  builder.onConflictDoUpdate = () => {
    sawConflict = true;
    const last = inserts[inserts.length - 1]!;
    last.onConflict = true;
    return builder;
  };
  return builder;
}

vi.mock("@/db", () => ({
  db: {
    select: () => chain(),
    update: () => chain(),
    delete: () => {
      deletes++;
      return chain();
    },
    insert: () => chain(),
  },
}));

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (args: any) => Promise<unknown>>(),
}));

vi.mock("@/src/lib/inngest/client", () => ({
  inngest: {
    createFunction: (config: any, handler: (args: any) => Promise<unknown>) => {
      handlers.set(config.id, handler);
      return { id: config.id };
    },
  },
}));

let resyncResult: Record<string, unknown>;

vi.mock("@/src/lib/github", () => ({
  getRepositoryFiles: vi.fn(),
  syncIssuesAndComments: vi.fn(),
  resyncRepositoryFiles: vi.fn(async () => resyncResult),
}));

// Only `parseGitHubUrl` is stubbed — `isIgnoredPath` has to stay real, because
// the "filtered paths must not trigger a prune" test is precisely about it.
vi.mock("@/src/lib/github/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/lib/github/utils")>()),
  parseGitHubUrl: () => ({ owner: "acme", repo: "widget" }),
}));

let fileResults: Record<string, unknown>[] = [];

vi.mock("@/src/features/rag/services/rag-ingestion", () => ({
  processFileForRag: vi.fn(
    async (fileId: string, filePath: string) =>
      fileResults.find((r) => r.fileId === fileId),
  ),
}));

vi.mock("@/src/lib/logger", () => ({
  logger: {
    error: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    debug: () => undefined,
  },
}));

import { resyncRepositoryFiles } from "@/src/lib/github/services/resync";
import { computeHash } from "@/src/features/rag/services/code-chunker";
import { processFileForRag } from "@/src/features/rag/services/rag-ingestion";
import { resyncProject, staleProjectResync } from "@/src/lib/inngest/functions";

// ── helpers ────────────────────────────────────────────────────────────────

/** Build a genuine gzipped tarball so the extractor under test is the real one. */
async function makeTarball(files: Record<string, string>): Promise<Readable> {
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  pack.on("data", (c: Buffer) => chunks.push(c));
  const ended = new Promise<void>((resolve) => pack.on("end", resolve));

  for (const [name, content] of Object.entries(files)) {
    pack.entry(
      { name: `widget-9f2a1c/${name}`, type: "file", size: Buffer.byteLength(content) },
      content,
    );
  }
  pack.finalize();
  await ended;

  return Readable.from(gzipSync(Buffer.concat(chunks)));
}

const { fetchRepoTarballStream } = vi.hoisted(() => ({
  fetchRepoTarballStream: vi.fn(),
}));
vi.mock("@/src/lib/github/client", () => ({
  fetchRepoTarballStream: (owner: string, repo: string) =>
    fetchRepoTarballStream(owner, repo),
  getGitHubAuthHeader: () => ({}),
}));

async function runResync(
  existing: Row[],
  files: Record<string, string>,
): Promise<Record<string, unknown>> {
  fetchRepoTarballStream.mockResolvedValue({ data: await makeTarball(files) });
  results = [existing];
  return (await resyncRepositoryFiles("acme", "widget", "project-1")) as never;
}

const step = {
  run: async (_name: string, fn: () => Promise<unknown>) => fn(),
  sendEvent: async () => undefined,
};

beforeEach(() => {
  results = [];
  updates = [];
  limits = [];
  inserts = [];
  deletes = 0;
  fileResults = [];
  resyncResult = {
    changedFileIds: [],
    added: 0,
    modified: 0,
    removed: 0,
    truncated: false,
    totalSeen: 0,
    unchanged: 0,
  };
  vi.mocked(processFileForRag).mockClear();
  vi.mocked(fetchRepoTarballStream).mockReset();
});

// ── the hash diff ──────────────────────────────────────────────────────────

describe("resyncRepositoryFiles", () => {
  it("writes nothing and reports zero changes when every file is byte-identical", async () => {
    const existing = [
      { id: "f1", fileName: "a.ts", hash: computeHash("const a = 1;") },
      { id: "f2", fileName: "b.ts", hash: computeHash("const b = 2;") },
    ];

    const out = await runResync(existing, {
      "a.ts": "const a = 1;",
      "b.ts": "const b = 2;",
    });

    expect(out.changedFileIds).toEqual([]);
    expect(out.unchanged).toBe(2);
    expect(out.added).toBe(0);
    expect(out.modified).toBe(0);
    // The point of the whole feature: an unchanged repo costs a tarball
    // download and a SHA-256 per file, and no writes and no embedding calls.
    expect(inserts).toEqual([]);
    expect(deletes).toBe(0);
  });

  it("upserts a changed file rather than inserting, and returns its existing id", async () => {
    const existing = [
      { id: "f1", fileName: "a.ts", hash: computeHash("const a = 1;") },
      { id: "f2", fileName: "b.ts", hash: computeHash("const b = 2;") },
    ];

    const out = await runResync(existing, {
      "a.ts": "const a = 999;", // changed
      "b.ts": "const b = 2;", // unchanged
    });

    expect(out.modified).toBe(1);
    expect(out.added).toBe(0);
    expect(out.unchanged).toBe(1);
    // The existing id, so code_embeddings.file_id keeps pointing at a live row.
    expect(out.changedFileIds).toEqual(["f1"]);

    expect(inserts).toHaveLength(1);
    // Without the conflict clause this violates
    // project_files_project_id_file_name_unique and aborts the batch.
    expect(inserts[0]!.onConflict).toBe(true);
    expect(inserts[0]!.values).toHaveLength(1);
    expect(inserts[0]!.values[0]!.fileName).toBe("a.ts");
    expect(inserts[0]!.values[0]!.hash).toBe(computeHash("const a = 999;"));
  });

  it("records an added file and resolves its new id from the database", async () => {
    const existing = [{ id: "f1", fileName: "a.ts", hash: computeHash("const a = 1;") }];

    fetchRepoTarballStream.mockResolvedValue({
      data: await makeTarball({ "a.ts": "const a = 1;", "new.ts": "export {};" }),
    });
    results = [existing, [{ id: "f9", fileName: "new.ts" }]];

    const out = (await resyncRepositoryFiles("acme", "widget", "project-1")) as never as {
      added: number;
      modified: number;
      changedFileIds: string[];
    };

    expect(out.added).toBe(1);
    expect(out.modified).toBe(0);
    expect(out.changedFileIds).toEqual(["f9"]);
    expect(inserts[0]!.onConflict).toBe(true);
  });

  it("prunes a file GitHub no longer has", async () => {
    const existing = [
      { id: "f1", fileName: "a.ts", hash: computeHash("const a = 1;") },
      { id: "gone", fileName: "deleted.ts", hash: computeHash("old") },
    ];

    const out = await runResync(existing, { "a.ts": "const a = 1;" });

    expect(out.removed).toBe(1);
    expect(deletes).toBe(1);
  });

  it("skips the prune when a hostile path proves the view is incomplete", async () => {
    const existing = [
      { id: "f1", fileName: "a.ts", hash: computeHash("const a = 1;") },
      { id: "gone", fileName: "deleted.ts", hash: computeHash("old") },
    ];

    // A `..` entry is never legitimate in a GitHub tarball. Its presence means
    // the archive is not what we think it is, so "absent" proves nothing and
    // every stored file would be a candidate for deletion.
    const out = await runResync(existing, {
      "a.ts": "const a = 1;",
      "../../etc/passwd": "root:x:0:0",
    });

    expect(out.truncated).toBe(true);
    expect(out.removed).toBe(0);
    expect(deletes).toBe(0);
  });

  it("ignores paths the importer never stored, so filtering cannot trigger a prune", async () => {
    const existing = [{ id: "f1", fileName: "a.ts", hash: computeHash("const a = 1;") }];

    // node_modules is in IGNORED_FILE_PATTERNS, so it is absent by design and
    // its absence says nothing about the repository.
    const out = await runResync(existing, {
      "a.ts": "const a = 1;",
      "node_modules/left-pad/index.js": "module.exports = 1;",
    });

    expect(out.truncated).toBe(false);
    expect(out.removed).toBe(0);
    expect(deletes).toBe(0);
  });
});

// ── the Inngest function ───────────────────────────────────────────────────

async function runResyncProject() {
  // Referenced for the side effect of registering the handler — the import is
  // otherwise elided and the module never loads, exactly as in the embeddings
  // test.
  void resyncProject;
  const handler = handlers.get("resync-project");
  if (!handler) throw new Error(`no resync-project handler; have ${[...handlers.keys()]}`);
  return handler({ event: { data: { projectId: "project-1" } }, step });
}

describe("resyncProject", () => {
  it("stamps lastSyncedAt and skips embedding entirely when nothing changed", async () => {
    // The staleness cron selects on lastSyncedAt, so an un-stamped no-op run
    // would be re-polled every night forever.
    results = [[{ githubUrl: "https://github.com/acme/widget" }]];
    resyncResult = {
      changedFileIds: [],
      added: 0,
      modified: 0,
      removed: 0,
      truncated: false,
      totalSeen: 12,
      unchanged: 12,
    };

    const out = (await runResyncProject()) as never as { changed: number };

    expect(out.changed).toBe(0);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.lastSyncedAt).toBeInstanceOf(Date);
    expect(processFileForRag).not.toHaveBeenCalled();
  });

  it("re-embeds exactly the changed files, uncapped", async () => {
    // githubUrl, then the embeddingStatus guard.
    results = [[{ githubUrl: "https://github.com/acme/widget" }], [{ embeddingStatus: "completed" }]];

    // Then one row per batch, three files → one batch of 3.
    results.push([
      { id: "f1", fileName: "a.ts", code: "a" },
      { id: "f2", fileName: "b.ts", code: "b" },
      { id: "f3", fileName: "c.ts", code: "c" },
    ]);
    fileResults = [
      { fileId: "f1", filePath: "a.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
      { fileId: "f2", filePath: "b.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
      { fileId: "f3", filePath: "c.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
    ];

    resyncResult = {
      changedFileIds: ["f1", "f2", "f3"],
      added: 1,
      modified: 2,
      removed: 1,
      truncated: false,
      totalSeen: 14,
      unchanged: 11,
    };

    const out = (await runResyncProject()) as never as { changed: number; embedded: number };

    expect(out.changed).toBe(3);
    expect(out.embedded).toBe(3);
    expect(processFileForRag).toHaveBeenCalledTimes(3);
    // No MAX_EMBEDDING_FILES cap: the delta is the exact changed set, so
    // there is nothing to select and nothing to truncate.
    expect(limits).toEqual([1, 1]);
    expect(updates[0]!.lastSyncedAt).toBeInstanceOf(Date);
    expect(updates[0]!.totalFiles).toBe(14);
  });

  it("defers without stamping when a full embedding run already owns the project", async () => {
    results = [[{ githubUrl: "https://github.com/acme/widget" }], [{ embeddingStatus: "processing" }]];

    resyncResult = {
      changedFileIds: ["f1"],
      added: 0,
      modified: 1,
      removed: 0,
      truncated: false,
      totalSeen: 3,
      unchanged: 2,
    };

    const out = (await runResyncProject()) as never as { reason?: string };

    expect(out.reason).toBe("embeddings-processing");
    // No stamp: the files were reconciled but not embedded, so the project is
    // still owed a pass and tomorrow's cron must pick it up.
    expect(updates).toEqual([]);
    expect(processFileForRag).not.toHaveBeenCalled();
  });
});

describe("staleProjectResync", () => {
  it("caps the nightly sweep at 20 projects to protect the shared token", async () => {
    results = [Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` }))];

    void staleProjectResync;
    const handler = handlers.get("stale-project-resync");
    if (!handler) throw new Error("no stale-project-resync handler");
    const out = (await handler({ event: { data: {} }, step })) as never as { triggered: number };

    expect(out.triggered).toBe(20);
    // 20 tarball streams against a 5,000/hr shared pool, every night.
    expect(limits).toEqual([20]);
  });
});
