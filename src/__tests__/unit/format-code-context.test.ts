import { describe, expect, it, vi } from "vitest";

// formatCodeContext sits in context-fetcher, which imports the db module at load.
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return { db: drizzle(async () => ({ rows: [] })) };
});

const { formatCodeContext } = await import("@/src/features/rag/services/rag/context-fetcher");
type CodeContext = import("@/src/features/rag/services/rag/context-fetcher").CodeContext;

function fileContext(count: number, bodyLength: number): CodeContext {
  return {
    type: "folder",
    files: Array.from({ length: count }, (_, i) => ({
      path: `src/file-${i}.ts`,
      content: "x".repeat(bodyLength),
    })),
    metadata: { totalFiles: count },
  };
}

describe("formatCodeContext", () => {
  it("returns everything when no budget is supplied", () => {
    const out = formatCodeContext(fileContext(6, 4000));
    expect(out).toContain("src/file-0.ts");
    expect(out).toContain("src/file-5.ts");
  });

  it("drops trailing files that would exceed maxTokens", () => {
    // 6 files x 4000 chars ~= 6 x 1000 tokens + fences/path overhead.
    const full = formatCodeContext(fileContext(6, 4000));
    const capped = formatCodeContext(fileContext(6, 4000), 2000);

    expect(capped.length).toBeLessThan(full.length);
    expect(capped).toContain("src/file-0.ts");
    expect(capped).not.toContain("src/file-5.ts");
  });

  it("keeps the highest-value files first, never a half file", () => {
    const capped = formatCodeContext(fileContext(6, 4000), 2000);
    // The cut lands on a file boundary: the tail is either a complete fenced
    // block or nothing at all, never a sliced code fence.
    const fences = (capped.match(/```/g) ?? []).length;
    expect(fences % 2).toBe(0);
    expect(capped.endsWith("```")).toBe(true);
  });
});
