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
import { isIgnoredPath } from "@/src/lib/github/utils";

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

// A committed secret that gets ingested lands in Postgres *and* in the vector
// store, where it is retrievable through RAG and reproducible as a citation.
describe("isIgnoredPath secret files", () => {
  const SECRETS = [
    "certs/server.pem",
    "config/app.key",
    "certs/keystore.p12",
    "certs/keystore.pfx",
    ".ssh/id_rsa",
    ".ssh/id_dsa",
    ".ssh/id_ecdsa",
    ".ssh/id_ed25519",
    ".npmrc",
    "home/.netrc",
    ".aws/credentials",
    "infra/prod.tfvars",
    "sub/.git/config",
  ];

  it.each(SECRETS)("ignores %s", (filePath) => {
    expect(isIgnoredPath(filePath)).toBe(true);
  });

  it("still ignores everything the list already covered", () => {
    for (const filePath of [
      "node_modules/react/index.js",
      "dist/main.js",
      ".env",
      ".env.production",
      "app.pyc",
      "assets/Inter-Regular.woff2",
      "debug.log",
    ]) {
      expect(isIgnoredPath(filePath)).toBe(true);
    }
  });

  it("does not over-broaden into ordinary source files", () => {
    for (const filePath of [
      "src/something.keyboard.ts",
      "src/keyboard.ts",
      "src/credentials.test.ts",
      "src/npmrc-parser.ts",
      "src/id_rsa_utils.go",
      "src/pem.ts",
      "src/index.ts",
      "docs/terraform.md",
    ]) {
      expect(isIgnoredPath(filePath)).toBe(false);
    }
  });
});
