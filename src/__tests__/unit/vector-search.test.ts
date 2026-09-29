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

import { searchSimilarCode } from "@/src/features/rag/services/vector-search";

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
