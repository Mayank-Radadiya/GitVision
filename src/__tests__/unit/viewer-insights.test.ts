import { describe, expect, it } from "vitest";
import type { FileEntry } from "@/features/projects/components/project-view/code-viewer/utils";
import {
  bucketLanguage,
  compactCount,
  concentrationTotal,
  entryPointCandidates,
  formatShare,
  languageLabel,
  languageSearchableShare,
  shareOf,
  summarizeLanguageIndex,
  tokenConcentration,
} from "@/features/projects/components/project-view/code-viewer/viewer-insights";

/** Minimal shape the pure functions actually read. */
function file(overrides: Partial<FileEntry> & { path: string }): FileEntry {
  return {
    id: `id-${overrides.path}`,
    language: "ts",
    lines: 10,
    bytes: 100,
    chunkCount: 3,
    tokenCount: 30,
    ...overrides,
  } as FileEntry;
}

describe("languageLabel", () => {
  it("maps known languages to display names", () => {
    expect(languageLabel("tsx")).toBe("TypeScript React");
    expect(languageLabel("PYTHON")).toBe("Python");
    expect(languageLabel("  go  ")).toBe("Go");
  });

  it("title-cases unknown languages instead of showing the raw key", () => {
    expect(languageLabel("zig")).toBe("Zig");
    expect(languageLabel("")).toBe("Plain text");
  });
});

describe("bucketLanguage", () => {
  it("falls back to text for absent languages", () => {
    expect(bucketLanguage(undefined)).toBe("text");
    expect(bucketLanguage(null)).toBe("text");
    expect(bucketLanguage("   ")).toBe("text");
    expect(bucketLanguage("  TS ")).toBe("ts");
  });
});

describe("shareOf", () => {
  it("returns a clamped 0–1 fraction", () => {
    expect(shareOf(5, 10)).toBe(0.5);
    expect(shareOf(20, 10)).toBe(1);
    expect(shareOf(0, 10)).toBe(0);
  });

  it("degrades to 0 rather than Infinity/NaN for an empty index", () => {
    expect(shareOf(5, 0)).toBe(0);
    expect(shareOf(0, 0)).toBe(0);
  });
});

describe("formatShare", () => {
  it("never lets a real share render as a bare 0%", () => {
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(0.0005)).toBe("<0.1%");
    expect(formatShare(0.1234)).toBe("12.3%");
  });
});

describe("compactCount", () => {
  it("compacts without rounding a real value to zero", () => {
    expect(compactCount(0)).toBe("0");
    expect(compactCount(999)).toBe("999");
    expect(compactCount(1200)).toBe("1.2K");
    expect(compactCount(45_600)).toBe("45.6K");
    expect(compactCount(1_100_000)).toBe("1.1M");
  });
});

describe("summarizeLanguageIndex", () => {
  const files = [
    file({ path: "a.ts", language: "ts", lines: 10, bytes: 100, tokenCount: 30, chunkCount: 3 }),
    file({ path: "b.ts", language: "ts", lines: 20, bytes: 200, tokenCount: 70, chunkCount: 0 }),
    file({ path: "c.py", language: "python", lines: 30, bytes: 300, tokenCount: 90, chunkCount: 9 }),
    file({ path: "d", language: undefined, lines: 0, bytes: 0, tokenCount: 0, chunkCount: 0 }),
  ];

  it("groups stored files by language and totals them", () => {
    const rows = summarizeLanguageIndex(files);
    expect(rows).toHaveLength(3);

    const ts = rows.find((row) => row.language === "ts");
    expect(ts).toMatchObject({
      fileCount: 2,
      lines: 30,
      bytes: 300,
      tokens: 100,
      searchableCount: 1,
    });
    expect(languageSearchableShare(ts!)).toBe(0.5);
  });

  it("orders by token weight, then file count, then label", () => {
    const rows = summarizeLanguageIndex(files);
    // ts is 100 tokens (30 + 70) against python's 90, so ts leads.
    expect(rows.map((row) => row.language)).toEqual(["ts", "python", "text"]);
  });

  it("breaks an exact token tie on label so the order never shuffles", () => {
    const rows = summarizeLanguageIndex([
      file({ path: "z.py", language: "python", tokenCount: 50 }),
      file({ path: "a.ts", language: "ts", tokenCount: 50 }),
    ]);
    // Tie broken on the *display* label: "Python" before "TypeScript".
    expect(rows.map((row) => row.language)).toEqual(["python", "ts"]);
  });

  it("is stable and total when given an empty index", () => {
    expect(summarizeLanguageIndex([])).toEqual([]);
  });
});

describe("tokenConcentration", () => {
  const files = [
    file({ path: "big.ts", tokenCount: 500 }),
    file({ path: "mid.ts", tokenCount: 300 }),
    file({ path: "small.ts", tokenCount: 100 }),
    file({ path: "unindexed.ts", tokenCount: 0 }),
  ];

  it("ranks by tokens and reports each share of the whole index", () => {
    const rows = tokenConcentration(files);
    expect(rows.map((row) => row.path)).toEqual(["big.ts", "mid.ts", "small.ts"]);
    // 500 of 900, not 500 of the top-5 total.
    expect(rows[0]?.share).toBeCloseTo(0.5556, 4);
    expect(concentrationTotal(rows)).toBeCloseTo(1, 6);
  });

  it("excludes files the index never embedded", () => {
    const rows = tokenConcentration(files);
    expect(rows.map((row) => row.path)).not.toContain("unindexed.ts");
  });

  it("honours the limit and never shares against a zero total", () => {
    expect(tokenConcentration(files, 2)).toHaveLength(2);
    expect(tokenConcentration(files, 0)).toEqual([]);
    expect(tokenConcentration([file({ path: "a.ts", tokenCount: 0 })])).toEqual([]);
  });

  it("breaks ties on path so the list is deterministic", () => {
    const rows = tokenConcentration([
      file({ path: "z.ts", tokenCount: 10 }),
      file({ path: "a.ts", tokenCount: 10 }),
    ]);
    expect(rows.map((row) => row.path)).toEqual(["a.ts", "z.ts"]);
  });
});

describe("entryPointCandidates", () => {
  it("prefers the README over everything else", () => {
    const rows = entryPointCandidates([
      file({ path: "src/index.ts" }),
      file({ path: "README.md" }),
      file({ path: "package.json" }),
    ]);
    expect(rows[0]?.path).toBe("README.md");
    expect(rows[0]?.reason).toBe("Project documentation");
  });

  it("then prefers conventional shallow names over arbitrary ones", () => {
    const rows = entryPointCandidates([
      file({ path: "src/deep/nested/index.ts" }),
      file({ path: "main.go" }),
      file({ path: "components/button.tsx" }),
    ]);
    // main.go scores 88 (rank 2 + depth-0 bonus); a nested index still wins on
    // its conventional name over a plain component file.
    expect(rows.map((row) => row.path)).toEqual([
      "main.go",
      "src/deep/nested/index.ts",
      "components/button.tsx",
    ]);
    expect(rows[2]?.reason).toBe("Top-level file");
  });

  it("offers top-level files as a fallback and stays deterministic", () => {
    const rows = entryPointCandidates([
      file({ path: "zzz.ts" }),
      file({ path: "deep/nested/other.ts" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ path: "zzz.ts", reason: "Top-level file" });
  });

  it("returns nothing when no file plausibly starts a read", () => {
    const rows = entryPointCandidates([
      file({ path: "a/b/c/d.ts" }),
      file({ path: "e/f/g/h.ts" }),
    ]);
    expect(rows).toEqual([]);
  });

  it("respects the limit", () => {
    const rows = entryPointCandidates(
      [
        file({ path: "README.md" }),
        file({ path: "index.ts" }),
        file({ path: "main.ts" }),
      ],
      2,
    );
    expect(rows).toHaveLength(2);
  });
});
