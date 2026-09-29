import { beforeEach, describe, expect, it, vi } from "vitest";
import { isIgnoredPath } from "@/src/lib/github/utils";

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

describe("isIgnoredPath", () => {
  // A committed secret is not just stored in Postgres — it is embedded and
  // retrievable through RAG, and comes back as a citation. Skipping it at
  // extraction is the only point where the content never lands.
  const SECRETS = [
    "certs/server.pem",
    "certs/server.key",
    "certs/server.p12",
    "certs/server.pfx",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "home/.ssh/id_rsa",
    "home/.ssh/id_ed25519",
    ".npmrc",
    "home/.netrc",
    "config/credentials",
    "terraform/prod.tfvars",
    "terraform/prod.tfvars.json",
    ".git/config",
  ];

  it.each(SECRETS)("ignores %s", (path) => {
    expect(isIgnoredPath(path)).toBe(true);
  });

  // The existing patterns must not have been narrowed by any of the above.
  const ALREADY_IGNORED = [
    ".env",
    ".env.local",
    "node_modules/left-pad/index.js",
    "dist/bundle.js",
    "logs/app.log",
    "assets/font.woff2",
    "src/__pycache__/mod.pyc",
    "logo.png",
  ];

  it.each(ALREADY_IGNORED)("still ignores %s", (path) => {
    expect(isIgnoredPath(path)).toBe(true);
  });

  // The `.key` pattern is the trap: unanchored, `\.key` swallows every
  // `something.keyboard.ts` in the repository.
  const STILL_INDEXED = [
    "src/something.keyboard.ts",
    "src/keymap.ts",
    "src/credential-store.ts",
    "src/credentials.ts",
    "terraform/main.tf",
    "terraform/variables.tf",
    "src/index.ts",
    "certs/public.crt",
  ];

  it.each(STILL_INDEXED)("still indexes %s", (path) => {
    expect(isIgnoredPath(path)).toBe(false);
  });
});
