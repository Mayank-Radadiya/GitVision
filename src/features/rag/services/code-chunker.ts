/**
 * Code chunking utilities for RAG
 *
 * Changes from v1:
 *   - Import-block prepending: every non-import chunk gets the file's import
 *     section prepended so the LLM always knows what's available in scope.
 *   - Parent-scope annotation: a comment header shows which class/function a
 *     chunk belongs to (e.g. "// In: class AuthService > method: validate").
 *   - Multi-language boundary detection: TypeScript/JavaScript (existing),
 *     Python (def/class), Go (func/type), Rust (fn/impl/struct/enum).
 *   - Overlap increased from 50 → 100 tokens for better continuity.
 */

import { createHash } from "crypto";

export interface CodeChunk {
  content: string;
  tokenCount: number;
  startLine: number;
  endLine: number;
  type:
    | "function"
    | "class"
    | "component"
    | "interface"
    | "type"
    | "import"
    | "other";
  /** Name of the parent scope, e.g. "AuthService.validateToken" */
  scopeLabel?: string;
}

// Approximate token count (1 token ≈ 4 characters for code)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Detect language from file extension
export function detectLanguage(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    cpp: "cpp",
    c: "c",
    h: "c",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    scala: "scala",
    r: "r",
    m: "objective-c",
    mm: "objective-c",
  };
  return ext ? languageMap[ext] || ext : null;
}

// Compute SHA-256 hash for content
export function computeHash(content: string): string {
  return createHash("sha256").update(content).update("v1").digest("hex");
}

// ---------------------------------------------------------------------------
// Import block extraction
// ---------------------------------------------------------------------------

/**
 * Extract the import/require block at the top of a file.
 * Returns an empty string if there are no imports.
 */
function extractImportBlock(code: string, language: string | null): string {
  const lines = code.split("\n");
  const importLines: string[] = [];

  if (language === "typescript" || language === "javascript") {
    for (const line of lines) {
      const trimmed = line.trim();
      // Collect import/require lines plus blank lines between them
      if (
        trimmed.startsWith("import ") ||
        trimmed.startsWith("const ") && trimmed.includes("require(") ||
        trimmed === "" && importLines.length > 0
      ) {
        importLines.push(line);
      } else if (importLines.length > 0 && !trimmed.startsWith("import")) {
        // First non-import non-blank line — stop
        break;
      }
    }
  } else if (language === "python") {
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("import ") ||
        trimmed.startsWith("from ") ||
        (trimmed === "" && importLines.length > 0)
      ) {
        importLines.push(line);
      } else if (importLines.length > 0) {
        break;
      }
    }
  } else if (language === "go") {
    // Go imports are inside an `import (...)` block or single-line `import "x"`
    let inImportBlock = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("import (")) {
        inImportBlock = true;
        importLines.push(line);
      } else if (inImportBlock) {
        importLines.push(line);
        if (trimmed === ")") break;
      } else if (trimmed.startsWith('import "')) {
        importLines.push(line);
      } else if (importLines.length > 0 && !trimmed.startsWith("import")) {
        break;
      }
    }
  } else if (language === "rust") {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("use ") || trimmed.startsWith("extern crate ")) {
        importLines.push(line);
      } else if (importLines.length > 0 && trimmed !== "") {
        break;
      }
    }
  }

  // Strip trailing blank lines
  while (importLines.length > 0 && importLines[importLines.length - 1].trim() === "") {
    importLines.pop();
  }

  return importLines.join("\n");
}

/**
 * Prepend the import block and an optional scope label to a chunk.
 * Skips prepending if the chunk itself IS the import block.
 */
function enrichChunk(
  chunk: CodeChunk,
  importBlock: string,
  filePath?: string,
): CodeChunk {
  if (chunk.type === "import" || !filePath) return chunk; // Don't double-prepend imports

  const parts: string[] = [];

  if (chunk.scopeLabel) {
    parts.push(`// Context: ${chunk.scopeLabel}`);
  }

  if (importBlock) {
    parts.push(`// --- imports ---\n${importBlock}\n// --- end imports ---`);
  }

  if (parts.length === 0) return chunk;

  const enriched = parts.join("\n") + "\n\n" + chunk.content;
  return {
    ...chunk,
    content: enriched,
    tokenCount: estimateTokens(enriched),
  };
}

// ---------------------------------------------------------------------------
// TypeScript / JavaScript boundary detection
// ---------------------------------------------------------------------------

interface Boundary {
  start: number;
  end: number;
  type: CodeChunk["type"];
  scopeLabel?: string;
}

function findTypeScriptBoundaries(code: string): Boundary[] {
  const boundaries: Boundary[] = [];
  const lines = code.split("\n");

  const patterns: Array<{
    regex: RegExp;
    type: CodeChunk["type"];
    nameGroup?: number;
  }> = [
    {
      regex: /^(export\s+)?(default\s+)?(async\s+)?function\s+(\w+)/,
      type: "function",
      nameGroup: 4,
    },
    {
      regex: /^(export\s+)?(async\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s*)?\(/,
      type: "function",
      nameGroup: 4,
    },
    { regex: /^(export\s+)?class\s+(\w+)/, type: "class", nameGroup: 2 },
    {
      regex: /^(export\s+)?interface\s+(\w+)/,
      type: "interface",
      nameGroup: 2,
    },
    { regex: /^(export\s+)?type\s+(\w+)/, type: "type", nameGroup: 2 },
    { regex: /^(import|export)\s+/, type: "import" },
    {
      regex: /^(export\s+)?(const|let|var)\s+(\w+)\s*[:=]/,
      type: "other",
      nameGroup: 3,
    },
  ];

  let currentBoundary: {
    start: number;
    type: CodeChunk["type"];
    name?: string;
  } | null = null;
  let braceCount = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (
      !trimmedLine ||
      trimmedLine.startsWith("//") ||
      trimmedLine.startsWith("/*") ||
      trimmedLine.startsWith("*")
    ) {
      continue;
    }

    if (!currentBoundary) {
      for (const pattern of patterns) {
        const match = trimmedLine.match(pattern.regex);
        if (match) {
          currentBoundary = {
            start: i,
            type: pattern.type,
            name: pattern.nameGroup ? match[pattern.nameGroup] : undefined,
          };
          braceCount = 0;
          break;
        }
      }
    }

    if (currentBoundary) {
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : "";

        if (!inString && (char === '"' || char === "'" || char === "`")) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && prevChar !== "\\") {
          inString = false;
        }

        if (!inString) {
          if (char === "{" || char === "(" || char === "[") braceCount++;
          else if (char === "}" || char === ")" || char === "]") braceCount--;
        }
      }

      if (braceCount === 0 && (trimmedLine === "" || i === lines.length - 1)) {
        boundaries.push({
          start: currentBoundary.start,
          end: i,
          type: currentBoundary.type,
          scopeLabel: currentBoundary.name,
        });
        currentBoundary = null;
      }
    }
  }

  if (currentBoundary) {
    boundaries.push({
      start: currentBoundary.start,
      end: lines.length - 1,
      type: currentBoundary.type,
      scopeLabel: currentBoundary.name,
    });
  }

  return boundaries;
}

// ---------------------------------------------------------------------------
// Python boundary detection
// ---------------------------------------------------------------------------

function findPythonBoundaries(code: string): Boundary[] {
  const boundaries: Boundary[] = [];
  const lines = code.split("\n");

  // top-level def / class (no leading whitespace)
  const topLevelPattern = /^(async\s+)?def\s+(\w+)|^class\s+(\w+)/;

  let currentStart: number | null = null;
  let currentType: CodeChunk["type"] = "other";
  let currentName: string | undefined;
  let baseIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = line.match(topLevelPattern);

    if (match) {
      // Save previous boundary
      if (currentStart !== null) {
        boundaries.push({
          start: currentStart,
          end: i - 1,
          type: currentType,
          scopeLabel: currentName,
        });
      }
      currentStart = i;
      currentType = match[0].trimStart().startsWith("class") ? "class" : "function";
      currentName = match[2] ?? match[3];
      baseIndent = line.search(/\S/);
    } else if (currentStart !== null) {
      // Detect end by returning to base indentation level on a non-blank line
      const indent = line.search(/\S/);
      if (indent <= baseIndent && indent !== -1 && !match) {
        boundaries.push({
          start: currentStart,
          end: i - 1,
          type: currentType,
          scopeLabel: currentName,
        });
        currentStart = null;
      }
    }
  }

  if (currentStart !== null) {
    boundaries.push({
      start: currentStart,
      end: lines.length - 1,
      type: currentType,
      scopeLabel: currentName,
    });
  }

  return boundaries;
}

// ---------------------------------------------------------------------------
// Go boundary detection
// ---------------------------------------------------------------------------

function findGoBoundaries(code: string): Boundary[] {
  const boundaries: Boundary[] = [];
  const lines = code.split("\n");

  // top-level func (method or plain) and type declarations
  const funcPattern = /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/;
  const typePattern = /^type\s+(\w+)\s+(struct|interface)/;

  let currentStart: number | null = null;
  let currentType: CodeChunk["type"] = "other";
  let currentName: string | undefined;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (currentStart === null) {
      const funcMatch = line.match(funcPattern);
      const typeMatch = line.match(typePattern);
      if (funcMatch) {
        currentStart = i;
        currentType = "function";
        currentName = funcMatch[1];
        braceDepth = 0;
      } else if (typeMatch) {
        currentStart = i;
        currentType = typeMatch[2] === "interface" ? "interface" : "class";
        currentName = typeMatch[1];
        braceDepth = 0;
      }
    }

    if (currentStart !== null) {
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        else if (ch === "}") braceDepth--;
      }
      if (braceDepth === 0 && i > currentStart) {
        boundaries.push({
          start: currentStart,
          end: i,
          type: currentType,
          scopeLabel: currentName,
        });
        currentStart = null;
      }
    }
  }

  return boundaries;
}

// ---------------------------------------------------------------------------
// Rust boundary detection
// ---------------------------------------------------------------------------

function findRustBoundaries(code: string): Boundary[] {
  const boundaries: Boundary[] = [];
  const lines = code.split("\n");

  const patterns: Array<{ regex: RegExp; type: CodeChunk["type"]; nameGroup: number }> = [
    { regex: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, type: "function", nameGroup: 1 },
    { regex: /^(?:pub\s+)?impl(?:\s+\w+)?\s+(\w+)/, type: "class", nameGroup: 1 },
    { regex: /^(?:pub\s+)?struct\s+(\w+)/, type: "class", nameGroup: 1 },
    { regex: /^(?:pub\s+)?enum\s+(\w+)/, type: "type", nameGroup: 1 },
  ];

  let currentStart: number | null = null;
  let currentType: CodeChunk["type"] = "other";
  let currentName: string | undefined;
  let braceDepth = 0;
  let inLineComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (currentStart === null) {
      for (const p of patterns) {
        const match = line.match(p.regex);
        if (match) {
          currentStart = i;
          currentType = p.type;
          currentName = match[p.nameGroup];
          braceDepth = 0;
          break;
        }
      }
    }

    if (currentStart !== null) {
      inLineComment = false;
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (!inLineComment && ch === "/" && line[j + 1] === "/") {
          inLineComment = true;
        }
        if (!inLineComment) {
          if (ch === "{") braceDepth++;
          else if (ch === "}") braceDepth--;
        }
      }
      if (braceDepth === 0 && i > currentStart) {
        boundaries.push({
          start: currentStart,
          end: i,
          type: currentType,
          scopeLabel: currentName,
        });
        currentStart = null;
      }
    }
  }

  return boundaries;
}

// ---------------------------------------------------------------------------
// Simple sliding-window fallback
// ---------------------------------------------------------------------------

function simpleChunking(
  code: string,
  maxTokens: number,
  overlapTokens: number,
): CodeChunk[] {
  const lines = code.split("\n");
  const chunks: CodeChunk[] = [];
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  let currentChunk: string[] = [];
  let currentStart = 0;
  let currentLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1;

    if (currentLength + lineLength > maxChars && currentChunk.length > 0) {
      const content = currentChunk.join("\n");
      chunks.push({
        content,
        tokenCount: estimateTokens(content),
        startLine: currentStart,
        endLine: i - 1,
        type: "other",
      });

      const overlapLines: string[] = [];
      let overlapLength = 0;
      for (
        let j = Math.max(0, currentChunk.length - Math.ceil(overlapChars / 50));
        j < currentChunk.length;
        j++
      ) {
        const overlapLine = currentChunk[j];
        if (overlapLength + overlapLine.length < overlapChars) {
          overlapLines.push(overlapLine);
          overlapLength += overlapLine.length + 1;
        }
      }

      currentChunk = overlapLines;
      currentLength = overlapLength;
      currentStart = i - overlapLines.length;
    }

    currentChunk.push(line);
    currentLength += lineLength;
  }

  if (currentChunk.length > 0) {
    const content = currentChunk.join("\n");
    chunks.push({
      content,
      tokenCount: estimateTokens(content),
      startLine: currentStart,
      endLine: lines.length - 1,
      type: "other",
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Boundary → chunks helper
// ---------------------------------------------------------------------------

function boundariesToChunks(
  boundaries: Boundary[],
  lines: string[],
  maxTokens: number,
  overlapTokens: number,
): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  for (const boundary of boundaries) {
    const chunkLines = lines.slice(boundary.start, boundary.end + 1);
    const content = chunkLines.join("\n");
    const tokenCount = estimateTokens(content);

    if (tokenCount > maxTokens) {
      // Split oversized boundaries with sliding window, then annotate each sub-chunk
      const subChunks = simpleChunking(content, maxTokens, overlapTokens);
      for (const sub of subChunks) {
        chunks.push({
          ...sub,
          startLine: boundary.start + sub.startLine,
          endLine: boundary.start + sub.endLine,
          type: boundary.type,
          scopeLabel: boundary.scopeLabel,
        });
      }
    } else {
      chunks.push({
        content,
        tokenCount,
        startLine: boundary.start,
        endLine: boundary.end,
        type: boundary.type,
        scopeLabel: boundary.scopeLabel,
      });
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Main public API
// ---------------------------------------------------------------------------

/**
 * Chunk a source file into semantically meaningful pieces for RAG.
 *
 * For TS/JS/Python/Go/Rust: uses language-aware boundary detection.
 * For all other languages: falls back to sliding-window.
 *
 * Every non-import chunk receives:
 *   1. The file's import block prepended (so the LLM knows about dependencies)
 *   2. A scope label comment (e.g. "// Context: AuthService.validateToken")
 */
export function chunkCode(
  code: string,
  filePath: string,
  maxTokens = 400,
  overlapTokens = 100, // increased from 50
): CodeChunk[] {
  const language = detectLanguage(filePath);
  const lines = code.split("\n");

  let boundaries: Boundary[] = [];

  if (language === "typescript" || language === "javascript") {
    boundaries = findTypeScriptBoundaries(code);
  } else if (language === "python") {
    boundaries = findPythonBoundaries(code);
  } else if (language === "go") {
    boundaries = findGoBoundaries(code);
  } else if (language === "rust") {
    boundaries = findRustBoundaries(code);
  }

  let rawChunks: CodeChunk[];

  if (boundaries.length > 0) {
    rawChunks = boundariesToChunks(boundaries, lines, maxTokens, overlapTokens);
  } else {
    rawChunks = simpleChunking(code, maxTokens, overlapTokens);
  }

  if (rawChunks.length === 0) return [];

  // Enrich chunks: prepend import block + scope label
  const importBlock = extractImportBlock(code, language);
  return rawChunks.map((chunk) => enrichChunk(chunk, importBlock, filePath));
}
