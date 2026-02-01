/**
 * Query Classification System
 *
 * Analyzes user queries to determine intent and extract relevant information.
 * Supports multiple query types: file-specific, folder-based, dependency analysis,
 * project overview, and general questions.
 */

export type QueryIntent =
  | "file-specific" // "explain Home.tsx"
  | "folder-based" // "show UI files"
  | "dependency-analysis" // "which dependencies"
  | "project-overview" // "overview of project"
  | "general-question"; // "how to authenticate"

export interface ClassifiedQuery {
  intent: QueryIntent;
  targets: string[]; // File names, folder patterns, keywords
  keywords: string[]; // Keywords for vector search
  originalQuery: string;
  confidence: number; // 0-1, how confident we are in classification
}

/**
 * Classification patterns for different query types
 */
const PATTERNS = {
  // File-specific: mentions file extensions
  fileSpecific: /\b[\w-]+\.(tsx?|jsx?|css|scss|py|java|go|rs|vue|svelte)\b/gi,

  // Folder-based: mentions folders, directories, multiple files
  folderBased:
    /(show|list|explain|describe|analyze).*(?:files?|folders?|directories?|components?|utils?|actions?|api|ui|pages?|layouts?)/i,

  // Dependency: mentions packages, dependencies
  dependency:
    /(?:which|what|show|list).*(?:dependency|dependencies|package|packages|npm|yarn|library|libraries|modules?)/i,

  // Overview: asks for overview, structure, summary
  overview:
    /(?:overview|structure|summarize|summary|describe|explain).*(?:project|codebase|repository|repo|app|application)|what.*(?:this project|codebase)/i,
};

/**
 * Folder keywords that indicate folder-based queries
 */
const FOLDER_KEYWORDS = [
  "component",
  "components",
  "ui",
  "interface",
  "util",
  "utils",
  "utility",
  "utilities",
  "action",
  "actions",
  "api",
  "apis",
  "page",
  "pages",
  "layout",
  "layouts",
  "service",
  "services",
  "hook",
  "hooks",
  "context",
  "contexts",
  "type",
  "types",
  "style",
  "styles",
  "asset",
  "assets",
  "config",
  "configs",
  "lib",
  "library",
  "helper",
  "helpers",
];

/**
 * Classifies a user query and extracts relevant information
 */
export function classifyQuery(query: string): ClassifiedQuery {
  // 1. Check for file-specific queries (highest priority)
  const fileMatches = query.match(PATTERNS.fileSpecific);
  if (fileMatches && fileMatches.length > 0) {
    return {
      intent: "file-specific",
      targets: fileMatches,
      keywords: extractKeywords(query),
      originalQuery: query,
      confidence: 0.9,
    };
  }

  // 2. Check for dependency queries
  if (PATTERNS.dependency.test(query)) {
    return {
      intent: "dependency-analysis",
      targets: [],
      keywords: ["dependencies", "packages"],
      originalQuery: query,
      confidence: 0.85,
    };
  }

  // 3. Check for overview queries
  if (PATTERNS.overview.test(query)) {
    return {
      intent: "project-overview",
      targets: [],
      keywords: ["structure", "overview", "architecture"],
      originalQuery: query,
      confidence: 0.85,
    };
  }

  // 4. Check for folder-based queries
  if (PATTERNS.folderBased.test(query)) {
    const folderTargets = extractFolderTargets(query);
    if (folderTargets.length > 0) {
      return {
        intent: "folder-based",
        targets: folderTargets,
        keywords: extractKeywords(query),
        originalQuery: query,
        confidence: 0.8,
      };
    }
  }

  // 5. Fallback: general question (use vector search)
  return {
    intent: "general-question",
    targets: [],
    keywords: extractKeywords(query),
    originalQuery: query,
    confidence: 0.6,
  };
}

/**
 * Extracts folder names/patterns from query
 */
function extractFolderTargets(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const targets: string[] = [];

  // Check for explicit folder keywords
  for (const keyword of FOLDER_KEYWORDS) {
    if (lowerQuery.includes(keyword)) {
      targets.push(keyword);
    }
  }

  // Check for folder patterns like "src/", "app/" etc.
  const folderPattern = /\b([\w-]+)\/\b/g;
  const folderMatches = query.match(folderPattern);
  if (folderMatches) {
    targets.push(...folderMatches.map((m) => m.replace("/", "")));
  }

  return [...new Set(targets)]; // Remove duplicates
}

/**
 * Extracts important keywords for vector search
 */
function extractKeywords(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "about",
    "is",
    "are",
    "was",
    "were",
    "show",
    "list",
    "explain",
    "describe",
    "what",
    "which",
    "how",
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)]; // Remove duplicates
}

/**
 * Helper to check if query is asking for multiple files
 */
export function isMultiFileQuery(query: string): boolean {
  const multiFileIndicators = [
    /all.*files?/i,
    /every.*files?/i,
    /list.*files?/i,
    /show.*files?/i,
  ];

  return multiFileIndicators.some((pattern) => pattern.test(query));
}

/**
 * Helper to extract action from query (explain, list, show, etc.)
 */
export function extractAction(query: string): string {
  const actionPattern =
    /^(explain|describe|show|list|analyze|summarize|what|how)/i;
  const match = query.match(actionPattern);
  return match ? match[1].toLowerCase() : "explain";
}
