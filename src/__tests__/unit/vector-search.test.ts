import { beforeEach, describe, expect, it, vi } from "vitest";
type Captured = { query: string; params: unknown[] };

const captured: Captured[] = [];
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

import {
  getAllProjectFilesForContext,
  reRankResults,
  searchSimilarCode,
} from "@/src/features/rag/services/vector-search";
import type { SearchResult } from "@/src/features/rag/services/vector-search";

const embedding = [0.1, 0.2, 0.3];

function makeRow(filePath: string, similarity: number) {
  return [filePath, filePath, "chunk", 0, 4, similarity];
}

beforeEach(() => {
  captured.length = 0;
  rows = [];
});

describe("searchSimilarCode", () => {
  it("orders by the raw cosine distance operator and keeps the threshold out of the WHERE clause", async () => {
    await searchSimilarCode("project-1", embedding, 8, 0.7);

    const { query } = captured[0]!;
    const where = query.slice(query.indexOf("where"), query.indexOf("order by"));

    // Ordering by the `1 - distance` similarity alias defeats embeddings_vector_idx,
    // so the raw `<=>` operator must stay in the ORDER BY.
    expect(query).toMatch(/order by .*embedding.* <=> \$\d+ asc/i);
    // The distance threshold is applied in JS, not as a post-filter inside the index scan.
    expect(where).not.toContain("<=>");
  });

  it("over-fetches a candidate pool larger than the requested limit", async () => {
    await searchSimilarCode("project-1", embedding, 8, 0.7);

    expect(captured[0]!.params.at(-1)).toBe(32);
  });

  it("drops candidates below minSimilarity in JS instead of losing them server-side", async () => {
    rows = [
      makeRow("a.ts", 0.92),
      makeRow("b.ts", 0.71),
      makeRow("c.ts", 0.69),
      makeRow("d.ts", 0.42),
    ] as unknown[][];

    const results = await searchSimilarCode("project-1", embedding, 8, 0.7);

    expect(results.map((r) => r.filePath)).toEqual(["a.ts", "b.ts"]);
  });
});

describe("reRankResults", () => {
  function makeResult(id: string, filePath: string, similarity: number): SearchResult {
    return {
      id,
      filePath,
      chunkContent: `chunk ${id}`,
      chunkIndex: Number(id),
      tokenCount: 4,
      similarity,
    };
  }

  it("still returns `limit` results when only two files hold every candidate", () => {
    // The 3-per-file diversity cap would stop at 6, but the caller asked for 8.
    const results = [
      ...Array.from({ length: 8 }, (_, i) => makeResult(`${i}`, "a.ts", 0.9 - i * 0.01)),
      ...Array.from({ length: 8 }, (_, i) => makeResult(`b${i}`, "b.ts", 0.8 - i * 0.01)),
    ];

    expect(reRankResults(results, "auth", 8)).toHaveLength(8);
  });

  it("keeps the 3-per-file cap while other files can still fill the limit", () => {
    const results = [
      ...Array.from({ length: 5 }, (_, i) => makeResult(`a${i}`, "a.ts", 0.99 - i * 0.01)),
      ...Array.from({ length: 3 }, (_, i) => makeResult(`b${i}`, "b.ts", 0.5 - i * 0.01)),
      ...Array.from({ length: 2 }, (_, i) => makeResult(`c${i}`, "c.ts", 0.4 - i * 0.01)),
    ];

    const ranked = reRankResults(results, "auth", 6);

    expect(ranked).toHaveLength(6);
    expect(ranked.filter((r) => r.filePath === "a.ts")).toHaveLength(3);
  });
});

describe("getAllProjectFilesForContext", () => {
  const small = "x".repeat(100);

  it("caps how many files the SQL query can return", async () => {
    rows = [["a.ts", small, "typescript"]];

    await getAllProjectFilesForContext("project-1");

    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/order by length\("project_files"\."code"\)/i);
    expect(captured[0].params.at(-1)).toBe(500);
  });

  it("truncates a single oversized file instead of handing back its whole body", async () => {
    rows = [["bundle.min.js", "y".repeat(200_000), "javascript"]];

    const context = await getAllProjectFilesForContext("project-1");

    expect(context).toContain("bundle.min.js");
    expect(context).toContain("truncated");
    expect(context).not.toContain("y".repeat(50_001));
  });
});
