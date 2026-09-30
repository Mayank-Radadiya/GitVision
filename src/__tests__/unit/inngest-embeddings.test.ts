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
  // `delayMs` lets a test make one batch resolve *after* a later one, which is
  // the only way to observe progress that is derived from completion order.
  processFileForRag: vi.fn(async (fileId: string, filePath: string) => {
    const result = fileResults.find((r) => r.fileId === fileId);
    const delayMs = (result as { delayMs?: number } | undefined)?.delayMs;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return result;
  }),
}));

vi.mock("@/src/lib/github", () => ({ getRepositoryFiles: vi.fn(), syncIssuesAndComments: vi.fn() }));

// The briefing step (F-15) runs after Finalize. Mocked so no test reaches
// Gemini, and so the default `null` leaves `updates.at(-1)` pointing at the
// Finalize write — which is what the assertions below inspect.
const { briefing } = vi.hoisted(() => ({
  briefing: { value: null as Record<string, unknown> | null },
}));

vi.mock("@/src/features/rag/services/rag/briefing-generator", () => ({
  generateRepoBriefing: vi.fn(async () => briefing.value),
}));

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
  briefing.value = null;
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

describe("generateEmbeddings batching", () => {
  // Batches run concurrently, so they resolve out of order. Progress is
  // published after each one completes and must never move backwards —
  // deriving it from the batch's position in the queue lets a late batch 1
  // overwrite batch 3's higher count.
  function twelveFiles() {
    results[1] = Array.from({ length: 12 }, (_, i) => ({
      id: `f${i + 1}`,
      fileName: `f${i + 1}.ts`,
      code: `const v = ${i};`,
    }));
    results[2] = [{ total: 12 }];
    fileResults = Array.from({ length: 12 }, (_, i) => ({
      fileId: `f${i + 1}`,
      filePath: `f${i + 1}.ts`,
      chunksProcessed: 1,
      embeddingsGenerated: 1,
      skipped: false,
    }));
  }

  function progressWrites() {
    return updates.filter(
      (u) => "embeddingProgress" in u && !("embeddingStatus" in u),
    );
  }

  it("publishes one progress write per batch", async () => {
    twelveFiles();

    await run();

    // 12 files at the default batch size of 5 is 3 batches.
    expect(progressWrites()).toHaveLength(3);
  });

  it("never reports less progress than it already reported", async () => {
    twelveFiles();
    // Make the very first batch the slowest, so it finishes after the batches
    // that follow it. Progress keyed off completion order must still climb.
    for (const r of fileResults.slice(0, 5)) {
      (r as { delayMs?: number }).delayMs = 30;
    }

    await run();

    const seen = progressWrites().map((u) => u.embeddingProgress as number);
    expect(seen).toHaveLength(3);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    }
  });

  it("counts a file as indexed only once it has succeeded", async () => {
    twelveFiles();
    // Batch 2's first file fails.
    fileResults[5] = {
      fileId: "f6",
      filePath: "f6.ts",
      chunksProcessed: 0,
      embeddingsGenerated: 0,
      skipped: false,
      error: "Embedding provider returned 0 of 1 chunks",
    };

    await run();

    const last = progressWrites().at(-1)!;
    expect(last.embeddingProgress).toBe(100);
    expect(last.indexedFileCount).toBe(11);
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

describe("generateEmbeddings briefing step (F-15)", () => {
  const BRIEFING = {
    summary: "A RAG chat app over indexed GitHub repositories.",
    description: "RAG chat over GitHub repositories.",
    techStack: ["Next.js", "Drizzle ORM"],
    keyComponents: [{ name: "Ingestion", role: "Indexes files.", paths: ["src/lib/inngest"] }],
    architecture: "Ingest, embed, retrieve.",
  };

  /** All files embed cleanly, so Finalize succeeds and the step is allowed to run. */
  function allHealthy() {
    fileResults = [
      { fileId: "f1", filePath: "a.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
      { fileId: "f2", filePath: "b.ts", chunksProcessed: 1, embeddingsGenerated: 1, skipped: false },
    ];
  }

  it("persists the briefing onto the project row", async () => {
    allHealthy();
    briefing.value = BRIEFING;

    const result = await run();

    expect(result).toMatchObject({ briefingGenerated: true });
    expect(updates.at(-1)).toMatchObject({ briefing: BRIEFING });
  });

  it("skips generation when indexing failed, so no repo is described half-indexed", async () => {
    // f2 errors by default, so Finalize marks the row failed.
    const result = await run();

    expect(result).toMatchObject({ success: false, briefingGenerated: false });
    expect(updates.some((u) => "briefing" in u)).toBe(false);
  });

  it("still reports the index completed when the generator returns null", async () => {
    allHealthy();
    briefing.value = null;

    const result = await run();

    expect(result).toMatchObject({ success: true, briefingGenerated: false });
    // The card renders an empty state; nothing about the index changes.
    expect(updates.at(-1)!.embeddingStatus).toBe("completed");
    expect(updates.some((u) => "briefing" in u)).toBe(false);
  });
});
