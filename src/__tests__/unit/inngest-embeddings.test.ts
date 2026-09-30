import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = unknown[];

// Terminal results for every awaited query, in the order functions.ts issues them.
let results: Row[] = [];
let updates: Record<string, unknown>[] = [];
// Every `.limit(n)` the code under test issues, in order.
let limits: number[] = [];

function chain() {
  // Selects always yield rows. An update yields rows only when `.returning()` is
  // chained — the bare progress writes (`.set().where()`) must not eat the queue.
  let expectsRows = true;
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(expectsRows ? (results.shift() ?? []) : []).then(resolve),
  };
  for (const method of ["select", "from", "where", "orderBy", "values", "insert", "delete"]) {
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
  return builder;
}

vi.mock("@/db", () => ({
  db: {
    select: () => chain(),
    update: () => chain(),
    delete: () => chain(),
    insert: () => chain(),
  },
}));

const { handlers, configs } = vi.hoisted(
  () => ({
    handlers: new Map<string, (args: any) => Promise<unknown>>(),
    configs: new Map<string, { id: string; onFailure?: (args: any) => Promise<unknown> }>(),
  }),
);

vi.mock("@/src/lib/inngest/client", () => ({
  inngest: {
    createFunction: (config: any, handler: (args: any) => Promise<unknown>) => {
      handlers.set(config.id, handler);
      configs.set(config.id, config);
      return { id: config.id };
    },
  },
}));

let fileResults: Record<string, unknown>[] = [];

vi.mock("@/src/features/rag/services/rag-ingestion", () => ({
  processFileForRag: vi.fn(async (fileId: string, filePath: string) => fileResults.find((r) => r.fileId === fileId)),
}));

vi.mock("@/src/lib/github", () => ({ getRepositoryFiles: vi.fn(), syncIssuesAndComments: vi.fn() }));

const { logs } = vi.hoisted(() => ({ logs: { error: [] as string[] } }));

vi.mock("@/src/lib/logger", () => ({
  logger: {
    error: (m: string) => {
      logs.error.push(m);
    },
    info: () => undefined,
    warn: () => undefined,
    debug: () => undefined,
  },
}));

import { cleanupStaleData, generateEmbeddings, projectCreated } from "@/src/lib/inngest/functions";
import { processFileForRag } from "@/src/features/rag/services/rag-ingestion";

const step = {
  run: async (_name: string, fn: () => Promise<unknown>) => fn(),
  sendEvent: async () => undefined,
};

async function run() {
  // Importing for the side effect of registering the handlers — an unused import
  // would be elided and the module would never load.
  void generateEmbeddings;
  const handler = handlers.get("generate-embeddings");
  if (!handler) throw new Error(`no handler; have ${JSON.stringify([...handlers.keys()])}`);
  return handler({ event: { data: { projectId: "project-1" } }, step });
}

beforeEach(() => {
  updates = [];
  limits = [];
  // claim, files, project_files count, embedding count, token sum
  results = [
    [{ id: "project-1" }],
    [
      { id: "f1", fileName: "a.ts", code: "const a = 1;" },
      { id: "f2", fileName: "b.ts", code: "const b = 2;" },
    ],
    [{ total: 2 }],
    [{ count: 42 }],
    [{ total: 1000 }],
  ];
  fileResults = [
    { fileId: "f1", filePath: "a.ts", chunksProcessed: 2, embeddingsGenerated: 2, skipped: false },
    { fileId: "f2", filePath: "b.ts", chunksProcessed: 1, embeddingsGenerated: 0, skipped: false, error: "Embedding provider returned 0 of 1 chunks" },
  ];
});

describe("generateEmbeddings finalize", () => {
  it("marks the project failed, not completed, when a file failed to embed", async () => {
    const result = await run();

    const final = updates.at(-1)!;
    expect(final.embeddingStatus).toBe("failed");
    expect(final.embeddingError).toContain("b.ts");
    expect(result).toMatchObject({ success: false });
  });

  it("marks the project completed when every file embedded cleanly", async () => {
    fileResults[1] = { fileId: "f2", filePath: "b.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false };

    await run();

    const final = updates.at(-1)!;
    expect(final.embeddingStatus).toBe("completed");
    expect(final.embeddingProgress).toBe(100);
  });
});

describe("onFailure hooks", () => {
  beforeEach(() => {
    logs.error = [];
  });

  it("projectCreated records a failed embedding status instead of stranding the project", async () => {
    void projectCreated;
    const onFailure = configs.get("project-created")!.onFailure;
    expect(onFailure).toBeTypeOf("function");

    await onFailure!({
      event: { data: { event: { data: { projectId: "project-1" } } } },
      error: { message: "boom" },
    });

    const final = updates.at(-1)!;
    expect(final.embeddingStatus).toBe("failed");
    expect(final.embeddingError).toContain("boom");
  });

  it("projectCreated logs and skips the write when the event carries no projectId", async () => {
    void projectCreated;
    const onFailure = configs.get("project-created")!.onFailure!;

    await expect(
      onFailure({ event: { data: { event: { data: {} } } }, error: { message: "boom" } }),
    ).resolves.toBeUndefined();
    expect(updates).toEqual([]);
    expect(logs.error.join(" ")).toContain("boom");
  });

  it("cleanupStaleData logs a failed sweep rather than failing silently", async () => {
    void cleanupStaleData;
    const onFailure = configs.get("cleanup-stale-data")!.onFailure;
    expect(onFailure).toBeTypeOf("function");

    await expect(onFailure!({ error: { message: "sweep blew up" } })).resolves.toBeUndefined();
    expect(logs.error.join(" ")).toContain("sweep blew up");
  });
});

describe("generateEmbeddings Prepare", () => {
  it("bounds the projectFiles read in SQL and truncates each file body", async () => {
    const big = "x".repeat(200_000);
    results[1] = [{ id: "f1", fileName: "big.ts", code: big }];
    fileResults = [{ fileId: "f1", filePath: "big.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false }];

    await run();

    // A LIMIT must be pushed into the query, not applied in JS.
    expect(limits).toEqual([expect.any(Number)]);
    // The body handed on to the Inngest step must be capped.
    const call = vi.mocked(processFileForRag).mock.calls[0];
    expect(call[2].length).toBeLessThan(big.length);
  });
});

/**
 * `totalFileCount` is zeroed by the claim, set to the real denominator by
 * Prepare, and never touched again — Finalize only republishes the numerator.
 * So read the last write that carries it, not the first.
 */
const publishedTotal = () => {
  for (let i = updates.length - 1; i >= 0; i--) {
    if ("totalFileCount" in updates[i]) return updates[i].totalFileCount;
  }
  return undefined;
};

describe("generateEmbeddings truncation", () => {
  it("marks the project partial, not completed, when the project has more files than the cap", async () => {
    // Two files come back from the bounded read, but the project has 1200.
    results[2] = [{ total: 1200 }];
    fileResults = [
      { fileId: "f1", filePath: "a.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
      { fileId: "f2", filePath: "b.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
    ];

    const result = await run();

    const final = updates.at(-1)!;
    expect(final.embeddingStatus).toBe("partial");
    expect(final.embeddingError).toContain("2 of 1200");
    expect(result).toMatchObject({ success: true, truncated: true });

    // The counts the UI reads instead of parsing the prose above. The run
    // embedded both selected files out of the project's 1200.
    expect(final.indexedFileCount).toBe(2);
    expect(publishedTotal()).toBe(1200);
  });

  it("still marks a fully covered project completed", async () => {
    fileResults = [
      { fileId: "f1", filePath: "a.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
      { fileId: "f2", filePath: "b.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
    ];

    const result = await run();

    expect(updates.at(-1)!.embeddingStatus).toBe("completed");
    expect(updates.at(-1)!.indexedFileCount).toBe(2);
    expect(publishedTotal()).toBe(2);
    expect(result).toMatchObject({ truncated: false });
  });

  it("reports a file error rather than a partial index when files also failed", async () => {
    results[2] = [{ total: 1200 }];

    const result = await run();

    // f2 errors by default, so the failure is the more urgent signal.
    expect(updates.at(-1)!.embeddingStatus).toBe("failed");
    // One of two files embedded — the counter reflects success, not attempts.
    expect(updates.at(-1)!.indexedFileCount).toBe(1);
    expect(publishedTotal()).toBe(1200);
    expect(result).toMatchObject({ success: false });
  });
});
