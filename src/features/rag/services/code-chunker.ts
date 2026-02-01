/**
 * Code chunking utilities for RAG
 * Intelligently chunks code while respecting logical boundaries
 */

import { createHash } from "crypto";

export interface CodeChunk {
  content: string;
  tokenCount: number;
  startLine: number;
  endLine: number;
  type: "function" | "class" | "component" | "interface" | "type" | "import" | "other";
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

// Find logical boundaries in TypeScript/JavaScript code
function findTypeScriptBoundaries(code: string): Array<{ start: number; end: number; type: CodeChunk["type"] }> {
  const boundaries: Array<{ start: number; end: number; type: CodeChunk["type"] }> = [];
  const lines = code.split("\n");
  
  // Patterns for different constructs
  const patterns = [
    { regex: /^(export\s+)?(async\s+)?function\s+\w+/, type: "function" as const },
    { regex: /^(export\s+)?(async\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/, type: "function" as const },
    { regex: /^(export\s+)?class\s+\w+/, type: "class" as const },
    { regex: /^(export\s+)?interface\s+\w+/, type: "interface" as const },
    { regex: /^(export\s+)?type\s+\w+/, type: "type" as const },
    { regex: /^(import|export)\s+/, type: "import" as const },
    { regex: /^(export\s+)?(const|let|var)\s+\w+\s*[:=]/, type: "other" as const },
  ];
  
  let currentBoundary: { start: number; type: CodeChunk["type"] } | null = null;
  let braceCount = 0;
  let inString = false;
  let stringChar = "";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith("//") || trimmedLine.startsWith("/*") || trimmedLine.startsWith("*")) {
      continue;
    }
    
    // Check for new boundary if not currently tracking one
    if (!currentBoundary) {
      for (const pattern of patterns) {
        if (pattern.regex.test(trimmedLine)) {
          currentBoundary = { start: i, type: pattern.type };
          braceCount = 0;
          break;
        }
      }
    }
    
    // Track braces and strings to find end of current construct
    if (currentBoundary) {
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : "";
        
        // Handle strings
        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
          inString = false;
        }
        
        // Handle braces (only when not in string)
        if (!inString) {
          if (char === '{' || char === '(' || char === '[') {
            braceCount++;
          } else if (char === '}' || char === ')' || char === ']') {
            braceCount--;
          }
        }
      }
      
      // End boundary when braces are balanced and we hit a blank line or new construct
      if (braceCount === 0 && (trimmedLine === '' || i === lines.length - 1)) {
        boundaries.push({
          start: currentBoundary.start,
          end: i,
          type: currentBoundary.type,
        });
        currentBoundary = null;
      }
    }
  }
  
  // Handle case where we ended while tracking a boundary
  if (currentBoundary) {
    boundaries.push({
      start: currentBoundary.start,
      end: lines.length - 1,
      type: currentBoundary.type,
    });
  }
  
  return boundaries;
}

// Simple line-based chunking fallback
function simpleChunking(code: string, maxTokens: number, overlapTokens: number): CodeChunk[] {
  const lines = code.split("\n");
  const chunks: CodeChunk[] = [];
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;
  
  let currentChunk: string[] = [];
  let currentStart = 0;
  let currentLength = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline
    
    if (currentLength + lineLength > maxChars && currentChunk.length > 0) {
      // Save current chunk
      const content = currentChunk.join("\n");
      chunks.push({
        content,
        tokenCount: estimateTokens(content),
        startLine: currentStart,
        endLine: i - 1,
        type: "other",
      });
      
      // Start new chunk with overlap
      const overlapLines: string[] = [];
      let overlapLength = 0;
      for (let j = Math.max(0, currentChunk.length - Math.ceil(overlapChars / 50)); j < currentChunk.length; j++) {
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
  
  // Don't forget the last chunk
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

// Main chunking function
export function chunkCode(
  code: string,
  filePath: string,
  maxTokens: number = 400,
  overlapTokens: number = 50
): CodeChunk[] {
  const language = detectLanguage(filePath);
  
  // For TypeScript/JavaScript, try intelligent chunking
  if (language === "typescript" || language === "javascript") {
    const boundaries = findTypeScriptBoundaries(code);
    
    if (boundaries.length > 0) {
      const lines = code.split("\n");
      const chunks: CodeChunk[] = [];
      
      for (const boundary of boundaries) {
        const chunkLines = lines.slice(boundary.start, boundary.end + 1);
        const content = chunkLines.join("\n");
        const tokenCount = estimateTokens(content);
        
        // If chunk is too large, split it further
        if (tokenCount > maxTokens) {
          const subChunks = simpleChunking(content, maxTokens, overlapTokens);
          for (const subChunk of subChunks) {
            chunks.push({
              ...subChunk,
              startLine: boundary.start + subChunk.startLine,
              endLine: boundary.start + subChunk.endLine,
              type: boundary.type,
            });
          }
        } else {
          chunks.push({
            content,
            tokenCount,
            startLine: boundary.start,
            endLine: boundary.end,
            type: boundary.type,
          });
        }
      }
      
      return chunks;
    }
  }
  
  // Fallback to simple chunking for other languages or when no boundaries found
  return simpleChunking(code, maxTokens, overlapTokens);
}
