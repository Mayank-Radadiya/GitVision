/**
 * Code Viewer — Utility Functions
 *
 * Language detection from file extensions and
 * flat path list → nested tree structure conversion.
 */

import type React from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileEntry {
  id: string;
  path: string;
  language: string;
}

export interface TreeNode {
  id?: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children: TreeNode[];
  language?: string;
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
          ...(isFile ? { language: file.language } : {}),
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
