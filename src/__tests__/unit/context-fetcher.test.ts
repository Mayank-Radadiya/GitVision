import { beforeEach, describe, expect, it, vi } from "vitest";

// context-fetcher instantiates the db module at load time.
const captured: { query: string; params: unknown[] }[] = [];
let rows: unknown[][] = [];

vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return {
    db: drizzle(async (query: string, params: unknown[]) => {
      captured.push({ query, params });
      return { rows };
    }),
  };
});

const { fetchContext, formatCodeContext } = await import(
  "@/src/features/rag/services/rag/context-fetcher"
);

function classified(targets: string[]) {
  return {
    intent: "file-specific" as const,
    targets,
    keywords: targets,
    originalQuery: "explain these files",
    confidence: 0.9,
  };
}

describe("fetchContext → file-specific", () => {
  beforeEach(() => {
    captured.length = 0;
    rows = [];
  });

  it("spends one capped query on 20 targets, not 20 capped queries", async () => {
    rows = Array.from({ length: 20 }, (_, i) => [
      `src/file-${i}.ts`,
      "x".repeat(40_000),
    ]);

    await fetchContext("project-1", classified([
      "a.ts", "b.ts", "c.ts", "d.ts", "e.ts",
      "f.ts", "g.ts", "h.ts", "i.ts", "j.ts",
      "k.ts", "l.ts", "m.ts", "n.ts", "o.ts",
      "p.ts", "q.ts", "r.ts", "s.ts", "t.ts",
    ]));

    // The stub DB ignores LIMIT, so assert the contract we control: one query,
    // and a bound limit of 5 for the whole answer.
    expect(captured).toHaveLength(1);
    expect(captured[0].params.at(-1)).toBe(5);
  });

  it("returns every file when no budget is supplied", async () => {
    rows = Array.from({ length: 3 }, (_, i) => [
      `src/file-${i}.ts`,
      "x".repeat(4000),
    ]);

    const ctx = await fetchContext("project-1", classified(["a.ts"]));
    const formatted = formatCodeContext(ctx);

    expect(formatted).toContain("src/file-0.ts");
    expect(formatted).toContain("src/file-2.ts");
  });

  it("keeps the formatted prompt inside the token budget", async () => {
    rows = Array.from({ length: 20 }, (_, i) => [
      `src/file-${i}.ts`,
      "x".repeat(40_000),
    ]);

    const ctx = await fetchContext(
      "project-1",
      classified(["a.ts", "b.ts", "c.ts", "d.ts"]),
    );
    const formatted = formatCodeContext(ctx, 12_000);

    // Each file is ~10k tokens, so a 12k budget admits exactly one of them.
    expect(formatted).toContain("src/file-0.ts");
    expect(formatted).not.toContain("src/file-1.ts");
  });
});
