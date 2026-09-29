import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = unknown[];

// Terminal results for every awaited query, in the order functions.ts issues them.
let results: Row[] = [];
let updates: Record<string, unknown>[] = [];

function chain() {
  // Selects always yield rows. An update yields rows only when `.returning()` is
  // chained — the bare progress writes (`.set().where()`) must not eat the queue.
  let expectsRows = true;
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(expectsRows ? (results.shift() ?? []) : []).then(resolve),
  };
  for (const method of ["select", "from", "where", "limit", "orderBy", "values", "insert", "delete"]) {
    builder[method] = () => builder;
  }
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

const { handlers } = vi.hoisted(
  () => ({ handlers: new Map<string, (args: any) => Promise<unknown>>() }),
);

vi.mock("@/src/lib/inngest/client", () => ({
  inngest: {
    createFunction: (config: { id: string }, handler: (args: any) => Promise<unknown>) => {
      handlers.set(config.id, handler);
      return { id: config.id };
    },
  },
}));

let fileResults: Record<string, unknown>[] = [];

vi.mock("@/src/features/rag/services/rag-ingestion", () => ({
  processFileForRag: vi.fn(async (fileId: string, filePath: string) => fileResults.find((r) => r.fileId === fileId)),
}));

vi.mock("@/src/lib/github", () => ({ getRepositoryFiles: vi.fn(), syncIssuesAndComments: vi.fn() }));

import { generateEmbeddings } from "@/src/lib/inngest/functions";

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
  // claim, files, embedding count, token sum
  results = [
    [{ id: "project-1" }],
    [
      { id: "f1", fileName: "a.ts", code: "const a = 1;" },
      { id: "f2", fileName: "b.ts", code: "const b = 2;" },
    ],
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
