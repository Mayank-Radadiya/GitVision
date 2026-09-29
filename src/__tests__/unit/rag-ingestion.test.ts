import { beforeEach, describe, expect, it, vi } from "vitest";

const chain = (rows: unknown[] = []) => {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  for (const method of ["select", "from", "where", "limit", "orderBy", "values", "insert", "update", "delete", "set", "returning"]) {
    builder[method] = () => builder;
  }
  return builder;
};

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => chain() }),
    update: () => chain(),
    delete: () => chain(),
    insert: () => chain(),
  },
}));

let embeddings: { index: number; embedding: number[] }[] = [];

vi.mock("@/src/features/rag/services/embeddings", () => ({
  generateEmbeddingsBatch: vi.fn(async () => embeddings),
  preprocessCodeForEmbedding: (content: string) => content,
}));

import { processFileForRag } from "@/src/features/rag/services/rag-ingestion";

beforeEach(() => {
  embeddings = [];
});

describe("processFileForRag", () => {
  it("reports an error when the embedding provider returns fewer embeddings than chunks", async () => {
    // One chunk, no embedding: the file is silently unsearchable today.
    embeddings = [];
    const result = await processFileForRag("file-1", "a.ts", "const a = 1;", "project-1");

    expect(result.embeddingsGenerated).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it("does not report an error when every chunk is embedded", async () => {
    embeddings = [{ index: 0, embedding: [0.1, 0.2, 0.3] }];
    const result = await processFileForRag("file-1", "a.ts", "const a = 1;", "project-1");

    expect(result.embeddingsGenerated).toBe(result.chunksProcessed);
    expect(result.error).toBeUndefined();
  });
});
