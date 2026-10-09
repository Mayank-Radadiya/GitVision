import { describe, expect, it } from "vitest";
import {
  applyIndexFilter,
  buildFileTree,
  filterViewerFiles,
  fuzzyPathMatch,
  summarizeIndexedFiles,
  type FileEntry,
} from "@/src/features/projects/components/project-view/code-viewer/utils";
import {
  initialViewerState,
  resolveActivePath,
  sanitizeRecentPaths,
  viewerReducer,
} from "@/src/features/projects/components/project-view/code-viewer/viewer-state";

describe("fuzzyPathMatch", () => {
  it("matches an empty query to every path", () => {
    expect(fuzzyPathMatch("", "/src/utils.ts").matched).toBe(true);
  });

  it("matches a subsequence with omitted characters", () => {
    expect(fuzzyPathMatch("srctls", "/src/utils.ts").matched).toBe(true);
  });

  it("rejects characters that never appear in order", () => {
    expect(fuzzyPathMatch("xyz", "/src/utils.ts").matched).toBe(false);
  });

  it("prefers contiguous and early matches to scattered ones", () => {
    const direct = fuzzyPathMatch("button", "/src/button.tsx");
    const scattered = fuzzyPathMatch("button", "/build-utils-tokens.ts");
    expect(direct.matched).toBe(true);
    expect(scattered.matched).toBe(true);
    expect(direct.score).toBeGreaterThan(scattered.score);
  });
});

describe("buildFileTree index facts", () => {
  it("marks a mixed directory as unresolved rather than choosing a side", () => {
    const tree = buildFileTree([
      {
        id: "a",
        path: "/src/a.ts",
        language: "typescript",
        chunkCount: 2,
        tokenCount: 120,
        indexState: "indexed",
      },
      {
        id: "b",
        path: "/src/b.ts",
        language: "typescript",
        chunkCount: 0,
        tokenCount: 0,
        indexState: "skipped",
      },
      {
        id: "readme",
        path: "/docs/readme.md",
        language: "markdown",
        chunkCount: 0,
        tokenCount: 0,
        indexState: "not-indexed",
      },
    ]);
    const src = tree.find((node) => node.path === "/src");

    expect(src?.indexState).toBe("unresolved");
    expect(src?.chunkCount).toBe(2);
    expect(src?.tokenCount).toBe(120);
  });

  it("summarizes one file array for every count the strip needs", () => {
    expect(
      summarizeIndexedFiles([
        {
          id: "a",
          path: "/a.ts",
          language: "typescript",
          lines: 3,
          bytes: 40,
          chunkCount: 2,
          tokenCount: 120,
          indexState: "indexed",
        },
        {
          id: "b",
          path: "/b.ts",
          language: "typescript",
          lines: 2,
          bytes: 30,
          chunkCount: 0,
          tokenCount: 0,
          indexState: "skipped",
        },
        {
          id: "c",
          path: "/c.ts",
          language: "typescript",
          lines: 1,
          bytes: 10,
          chunkCount: 0,
          tokenCount: 0,
        },
      ]),
    ).toStrictEqual({
      stored: 3,
      indexed: 1,
      skipped: 1,
      notIndexed: 1,
      chunks: 2,
      tokens: 120,
      lines: 6,
      bytes: 80,
    });
  });
});

describe("viewer selection state", () => {
  const available = new Set(["/a.ts", "/b.ts"]);

  it("prefers an explicit selection over deep links and defaults", () => {
    expect(
      resolveActivePath({
        files: available,
        selectedPath: "/b.ts",
        requestedPath: "/a.ts",
        autoSelectedPath: "/a.ts",
      }),
    ).toBe("/b.ts");
  });

  it("falls through invalid selections instead of blanking the viewer", () => {
    expect(
      resolveActivePath({
        files: available,
        selectedPath: "/deleted.ts",
        requestedPath: "/missing.ts",
        autoSelectedPath: "/a.ts",
      }),
    ).toBe("/a.ts");
  });

  it("rejects an unknown selection without touching state", () => {
    const next = viewerReducer(
      initialViewerState({ recentPaths: ["/a.ts"] }),
      { type: "select-file", path: "/deleted.ts", available },
    );

    expect(next.selectedPath).toBeNull();
    expect(next.recentPaths).toEqual(["/a.ts"]);
  });

  it("prunes stored recents to live files, without duplicates, capped at eight", () => {
    const live = new Set(
      Array.from({ length: 12 }, (_, index) => `/file-${index}.ts`),
    );
    const stored = [
      "/file-9.ts",
      "/deleted.ts",
      "/file-9.ts",
      ...Array.from({ length: 11 }, (_, index) => `/file-${index}.ts`),
      42,
    ];

    expect(sanitizeRecentPaths(stored, live)).toHaveLength(8);
    expect(sanitizeRecentPaths(stored, live)[0]).toBe("/file-9.ts");
    expect(sanitizeRecentPaths(stored, live)).not.toContain("/deleted.ts");
  });
});

describe("filterViewerFiles", () => {
  const files: FileEntry[] = [
    { id: "a", path: "/src/button.tsx", language: "tsx", indexState: "indexed" },
    { id: "b", path: "/src/utils-tokens.ts", language: "typescript", indexState: "skipped" },
    { id: "c", path: "/docs/readme.md", language: "markdown", indexState: "not-indexed" },
  ];

  it("returns every file for an empty query", () => {
    expect(filterViewerFiles(files, "")).toHaveLength(3);
    expect(filterViewerFiles(files, "   ")).toHaveLength(3);
  });

  it("ranks the tighter path hit first", () => {
    const ranked = filterViewerFiles(files, "button");
    expect(ranked.map((file) => file.path)).toEqual(["/src/button.tsx"]);
  });

  it("treats a trailing slash as a folder prefix, not a fuzzy query", () => {
    expect(
      filterViewerFiles(files, "/src/").map((file) => file.path).sort(),
    ).toEqual(["/src/button.tsx", "/src/utils-tokens.ts"]);
    expect(filterViewerFiles(files, "/docs/").map((file) => file.path)).toEqual([
      "/docs/readme.md",
    ]);
    expect(filterViewerFiles(files, "/missing/")).toHaveLength(0);
  });
});

describe("applyIndexFilter", () => {
  const files: FileEntry[] = [
    { id: "a", path: "/a.ts", language: "typescript", indexState: "indexed" },
    { id: "b", path: "/b.ts", language: "typescript", indexState: "skipped" },
    { id: "c", path: "/c.ts", language: "typescript", indexState: "not-indexed" },
    { id: "d", path: "/d.ts", language: "typescript" },
  ];

  it("keeps everything on all", () => {
    expect(applyIndexFilter(files, "all")).toHaveLength(4);
  });

  it("keeps only searchable files on searchable", () => {
    expect(applyIndexFilter(files, "searchable").map((file) => file.id)).toEqual([
      "a",
    ]);
  });

  it("groups skipped files with the not-indexed chip", () => {
    expect(
      applyIndexFilter(files, "not-indexed").map((file) => file.id).sort(),
    ).toEqual(["b", "c", "d"]);
  });
});
