/**
 * Code Viewer — Utility Functions
 *
 * Language detection from file extensions and
 * flat path list → nested tree structure conversion.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileEntry {
  path: string;
  content: string;
  language: string;
}

export interface TreeNode {
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

/** Detect Shiki language from file path */
export function detectLanguage(filePath: string): string {
  const fileName = filePath.split("/").pop() || "";
  const lowerName = fileName.toLowerCase();

  // Special file names
  if (lowerName === "dockerfile") return "dockerfile";
  if (lowerName === "makefile") return "makefile";
  if (lowerName === ".env" || lowerName.startsWith(".env.")) return "bash";

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return EXTENSION_MAP[ext] || "text";
}

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
