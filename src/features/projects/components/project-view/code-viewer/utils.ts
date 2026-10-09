/**
 * Code Viewer — Utility Functions
 *
 * Language detection from file extensions and
 * flat path list → nested tree structure conversion.
 */

import type React from "react";
import type { FileIndexState } from "@/src/lib/file-index-state";
import type { ViewerIndexFilter } from "./viewer-state";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileEntry {
  id: string;
  path: string;
  language: string;
  lines?: number;
  bytes?: number;
  chunkCount?: number;
  tokenCount?: number;
  indexState?: FileIndexState;
}

export type DirectoryIndexState = FileIndexState | "unresolved";

export interface TreeNode {
  id?: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children: TreeNode[];
  language?: string;
  /** Stored line count, summed for directories. */
  lines?: number;
  chunkCount?: number;
  tokenCount?: number;
  indexState?: FileIndexState | DirectoryIndexState;
}

// ─── Shiki Theme Options ─────────────────────────────────────────────────────

export interface ThemeOption {
  id: string;
  label: string;
  type: "dark" | "light";
}

/** Curated theme list — popular VS Code themes only */
export const CODE_THEMES: ThemeOption[] = [
  { id: "github-dark", label: "GitHub Dark", type: "dark" },
  { id: "github-light", label: "GitHub Light", type: "light" },
  { id: "one-dark-pro", label: "One Dark Pro", type: "dark" },
  { id: "dracula", label: "Dracula", type: "dark" },
  { id: "nord", label: "Nord", type: "dark" },
  { id: "min-light", label: "Min Light", type: "light" },
  { id: "vitesse-dark", label: "Vitesse Dark", type: "dark" },
  { id: "tokyo-night", label: "Tokyo Night", type: "dark" },
];

// ─── Language Detection ──────────────────────────────────────────────────────

const EXTENSION_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  mdx: "mdx",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "dockerfile",
  tf: "hcl",
  prisma: "prisma",
  env: "bash",
  gitignore: "text",
  txt: "text",
};

// ─── Tree Building ───────────────────────────────────────────────────────────

/**
 * Convert flat file list to nested tree structure.
 * Sorts: directories first (alphabetical), then files (alphabetical).
 */
export function buildFileTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    // Remove leading slash for processing
    const cleanPath = file.path.startsWith("/")
      ? file.path.slice(1)
      : file.path;
    const parts = cleanPath.split("/");

    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const fullPath = "/" + parts.slice(0, i + 1).join("/");

      // Check if node already exists at this level
      let existing = currentLevel.find((n) => n.name === part);

      if (!existing) {
        const node: TreeNode = {
          id: isFile ? file.id : undefined,
          name: part,
          path: fullPath,
          type: isFile ? "file" : "directory",
          children: [],
          ...(isFile
            ? {
                language: file.language,
                lines: toNonNegativeCount(file.lines),
                chunkCount: file.chunkCount ?? 0,
                tokenCount: file.tokenCount ?? 0,
                indexState: file.indexState ?? "not-indexed",
              }
            : {}),
        };
        currentLevel.push(node);
        existing = node;
      }

      // Descend into directory
      if (!isFile) {
        currentLevel = existing.children;
      }
    }
  }

  // Recursively sort: directories first, then files, both alphabetical
  sortTree(root);
  for (const node of root) aggregateDirectoryIndex(node);
  return root;
}

function sortTree(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children.length > 0) sortTree(node.children);
  }
}

/**
 * Directory facts are derived from the visible leaves, not stored anywhere.
 *
 * A folder is only as searchable as all of its files: one mixed folder becomes
 * `unresolved`, which is why the rail can show a neutral directory dot without
 * pretending part of a folder is indexed. Chunk and token counts add, so a
 * folder tooltip can say how much index lives beneath it.
 */
function aggregateDirectoryIndex(node: TreeNode): {
  chunks: number;
  tokens: number;
  lines: number;
  state: FileIndexState | DirectoryIndexState;
} {
  if (node.type === "file") {
    const chunks = toNonNegativeCount(node.chunkCount);
    const tokens = toNonNegativeCount(node.tokenCount);
    const state = node.indexState ?? "not-indexed";
    node.chunkCount = chunks;
    node.tokenCount = tokens;
    node.indexState = state;
    return { chunks, tokens, lines: toNonNegativeCount(node.lines), state };
  }
  let chunks = 0;
  let tokens = 0;
  let lines = 0;
  const states = new Set<FileIndexState | DirectoryIndexState>();
  for (const child of node.children) {
    const childFacts = aggregateDirectoryIndex(child);
    chunks += childFacts.chunks;
    tokens += childFacts.tokens;
    lines += childFacts.lines;
    states.add(childFacts.state);
  }

  const state: FileIndexState | DirectoryIndexState =
    states.size === 1 ? [...states][0]! : "unresolved";
  node.chunkCount = chunks;
  node.tokenCount = tokens;
  node.lines = lines;
  node.indexState = node.children.length > 0 ? state : "not-indexed";
  return {
    chunks,
    tokens,
    lines,
    state: node.indexState,
  };
}

function toNonNegativeCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value as number));
}

// ─── Fuzzy path search ───────────────────────────────────────────────────────

/** Subsequence match plus a ranking score: higher means a tighter path hit. */
export interface FuzzyPathMatch {
  matched: boolean;
  score: number;
}

const PATH_BOUNDARIES = new Set(["/", "-", "_", "."]);

/**
 * Match a compact query against a file path.
 *
 * Empty query matches everything; otherwise every query character must appear
 * in order. Contiguous runs, matches after a path boundary, and early/short
 * matches score higher, so `button` prefers `/button.tsx` to a scattered
 * `build-utils...ton` coincidence.
 */
export function fuzzyPathMatch(query: string, target: string): FuzzyPathMatch {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTarget = target.toLowerCase();
  if (!normalizedQuery) return { matched: true, score: 0 };

  let score = 0;
  let queryIndex = 0;
  let previousIndex = -10;
  let run = 0;
  let firstIndex = -1;

  for (let i = 0; i < normalizedTarget.length; i++) {
    if (normalizedTarget[i] !== normalizedQuery[queryIndex]) continue;
    if (firstIndex === -1) firstIndex = i;
    score += 10;
    if (i === 0 || PATH_BOUNDARIES.has(normalizedTarget[i - 1]!)) score += 12;
    if (i === previousIndex + 1) {
      run += 1;
      score += run * 8;
    } else {
      run = 0;
    }
    previousIndex = i;
    queryIndex += 1;
    if (queryIndex >= normalizedQuery.length) break;
  }

  if (queryIndex < normalizedQuery.length) return { matched: false, score: 0 };
  score += Math.max(0, 120 - firstIndex * 2);
  score += Math.max(0, 60 - (normalizedTarget.length - normalizedQuery.length));
  return { matched: true, score };
}

// ─── Retrieval facts ─────────────────────────────────────────────────────────

export interface IndexedFileSummary {
  stored: number;
  indexed: number;
  skipped: number;
  notIndexed: number;
  chunks: number;
  tokens: number;
  lines: number;
  bytes: number;
}

/**
 * Count the strip, chips, and tooltips from one file array.
 *
 * Missing states degrade to `not-indexed`: an absent server fact must never
 * inflate the searchable count.
 */
export function summarizeIndexedFiles(files: readonly FileEntry[]): IndexedFileSummary {
  return files.reduce<IndexedFileSummary>(
    (summary, file) => ({
      stored: summary.stored + 1,
      indexed: summary.indexed + (file.indexState === "indexed" ? 1 : 0),
      skipped: summary.skipped + (file.indexState === "skipped" ? 1 : 0),
      notIndexed:
        summary.notIndexed + (file.indexState === "indexed" || file.indexState === "skipped" ? 0 : 1),
      chunks: summary.chunks + toNonNegativeCount(file.chunkCount),
      tokens: summary.tokens + toNonNegativeCount(file.tokenCount),
      lines: summary.lines + toNonNegativeCount(file.lines),
      bytes: summary.bytes + toNonNegativeCount(file.bytes),
    }),
    {
      stored: 0,
      indexed: 0,
      skipped: 0,
      notIndexed: 0,
      chunks: 0,
      tokens: 0,
      lines: 0,
      bytes: 0,
    },
  );
}
/**
 * Filter the rail by path query, then rank the survivors.
 *
 * A trailing slash turns the query into a folder prefix: clicking a
 * breadcrumb folder narrows the explorer to that folder instead of
 * fuzzy-matching its characters against every path. Everything else goes
 * through the fuzzy matcher, best score first.
 */
export function filterViewerFiles(
  files: readonly FileEntry[],
  query: string,
): FileEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...files];
  if (normalized.endsWith("/")) {
    return files.filter((file) =>
      file.path.toLowerCase().startsWith(normalized),
    );
  }
  return files
    .map((file) => ({ file, match: fuzzyPathMatch(query, file.path) }))
    .filter((entry) => entry.match.matched)
    .sort((a, b) => b.match.score - a.match.score)
    .map((entry) => entry.file);
}

/**
 * Narrow the rail to a searchability band.
 *
 * "not-indexed" means not searchable, so skipped files sit with the
 * never-reached ones: the chip answers "what can I not ask about?".
 */
export function applyIndexFilter(
  files: readonly FileEntry[],
  filter: ViewerIndexFilter,
): FileEntry[] {
  if (filter === "searchable") {
    return files.filter((file) => file.indexState === "indexed");
  }
  if (filter === "not-indexed") {
    return files.filter((file) => file.indexState !== "indexed");
  }
  return [...files];
}
// ─── Virtualized Rendering ───────────────────────────────────────────────────

export interface HighlightedLines {
  /** Background/color lifted off the <pre> so the container can adopt it. */
  preStyle: React.CSSProperties;
  /** One entry per source line, ready to drop into a virtual row. */
  lines: string[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parsePreStyle(style: string | undefined): React.CSSProperties {
  if (!style) return {};
  // The style attribute is a flat `a:b;c:d` list; split on the first colon
  // only so a value containing one (`url(a:b)`) survives. React wants
  // camelCase keys, so `background-color` becomes `backgroundColor`.
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim();
    const value = decl.slice(colon + 1).trim();
    if (!prop || !value) continue;
    out[prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  return out as React.CSSProperties;
}

/**
 * Turns a Shiki `codeToHtml` blob into the per-line strings the virtualizer
 * windows. Shiki tokenizes per line, so the only `\n` characters in its output
 * are line separators and splitting on a newline that precedes a line span is
 * unambiguous. Falls back to escaped raw lines when the input is the
 * un-highlighted `<pre class="shiki"><code>…</code></pre>` placeholder, which
 * carries no line spans.
 */
export function splitHighlightedLines(
  html: string,
  rawContent: string,
): HighlightedLines {
  const openPre = html.match(/<pre\b([^>]*)>/);
  if (!openPre) {
    return { preStyle: {}, lines: escapeLines(rawContent) };
  }

  const preStyle = parsePreStyle(openPre[1].match(/style="([^"]*)"/)?.[1]);
  const inner = html
    .slice(openPre[0].length)
    .replace(/^<code[^>]*>/, "")
    .replace(/<\/code>\s*<\/pre>\s*$/, "");

  if (!inner.includes('<span class="line"')) {
    return { preStyle, lines: escapeLines(rawContent) };
  }

  return { preStyle, lines: inner.split(/\n(?=<span class="line">)/) };
}

function escapeLines(rawContent: string): string[] {
  // An empty file still needs one row, otherwise the virtualizer mounts nothing.
  return (rawContent === "" ? [""] : rawContent.split("\n")).map(escapeHtml);
}
