import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isIgnoredPath, parseGitHubUrl } from "@/src/lib/github/utils";

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

describe("parseGitHubUrl", () => {
  // D-9 chose the docstring fix over SSH/Enterprise support, so the contract is
  // exactly the two HTTPS forms below. Everything else is either rejected or
  // unvalidated — the docstring says so, and these tests are what stops it
  // drifting back into a claim the code cannot honour.
  const HTTPS_FORMS = [
    ["https://github.com/octocat/Hello-World", "octocat", "Hello-World"],
    ["https://github.com/octocat/Hello-World.git", "octocat", "Hello-World"],
  ] as const;

  it.each(HTTPS_FORMS)("parses %s", (url, owner, repo) => {
    expect(parseGitHubUrl(url)).toEqual({ owner, repo });
  });

  it.each(["", "not-a-url", "https://github.com/"])(
    "rejects %p",
    (url) => {
      expect(() => parseGitHubUrl(url)).toThrow();
    },
  );

  it("does not check the host, and the docstring says so", () => {
    // Deliberate: `validators.githubUrl` is the thing that enforces
    // github.com + HTTPS, and it runs on the create-project input, not here.
    // parseGitHubUrl only ever looks at the last two path segments, so
    // whatever reaches it is trusted. If the docstring stops admitting that,
    // someone will rely on it not being true.
    expect(parseGitHubUrl("https://gitlab.com/octocat/Hello-World")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
    // A one-segment URL is not rejected either — the owner slot falls back to
    // the host segment. This is the shape an SSH remote produces.
    expect(parseGitHubUrl("https://github.com/only-owner")).toEqual({
      owner: "github.com",
      repo: "only-owner",
    });
  });

  it("claims no format support its parser does not have", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/github/utils.ts"),
      "utf8",
    );
    // The docstring is the only thing a user pasting an SSH remote ever sees,
    // so it has to describe the parser that actually exists.
    expect(source).not.toMatch(/supports[^.]*\bSSH\b/i);
    expect(source).not.toMatch(/supports[^.]*shorthand/i);
    expect(source).toMatch(/https:\/\/github\.com\/owner\/repo/);
  });

  it("makes no atomicity claim createNewProject cannot honour", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/github/services/project.ts"),
      "utf8",
    );
    // neon-http has no db.transaction(), and the function body already says
    // so at length. Only the header claimed atomicity, and a header is what
    // people read — so the guard is scoped to the header, not the file: the
    // header may name the missing transaction, it may not promise atomicity.
    const header = source.slice(
      source.indexOf("/**"),
      source.indexOf("export async function createNewProject"),
    );
    expect(header).not.toMatch(/atomicity/i);
    expect(header).not.toMatch(/wrapped in a database transaction/i);
    expect(header).toMatch(/not atomic|no db\.transaction/i);
  });
});
