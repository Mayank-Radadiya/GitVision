/**
 * Vector similarity search for code embeddings
 * Performs cosine similarity search on code chunks
 */

import { db } from "@/db";
import { codeEmbeddings, projectFiles } from "@/db/schema";
import { cosineDistance, desc, gt, sql, eq, and, inArray } from "drizzle-orm";

export interface SearchResult {
  id: string;
  filePath: string;
  chunkContent: string;
  chunkIndex: number;
  tokenCount: number;
  similarity: number;
}

/**
 * Search for similar code chunks using cosine similarity
 * 
 * @param projectId - Project to search within
 * @param queryEmbedding - Vector embedding of the search query
 * @param limit - Maximum number of results (default: 8)
 * @param minSimilarity - Minimum similarity threshold 0-1 (default: 0.7)
 * @returns Array of matching code chunks with similarity scores
 */
export async function searchSimilarCode(
  projectId: string,
  queryEmbedding: number[],
  limit: number = 8,
  minSimilarity: number = 0.7
): Promise<SearchResult[]> {
  try {
    // Calculate cosine similarity (1 - distance)
    const similarity = sql<number>`1 - (${cosineDistance(codeEmbeddings.embedding, queryEmbedding)})`;
    
    const results = await db
      .select({
        id: codeEmbeddings.id,
        filePath: codeEmbeddings.filePath,
        chunkContent: codeEmbeddings.chunkContent,
        chunkIndex: codeEmbeddings.chunkIndex,
        tokenCount: codeEmbeddings.tokenCount,
        similarity: similarity,
      })
      .from(codeEmbeddings)
      .where(
        and(
          eq(codeEmbeddings.projectId, projectId),
          gt(similarity, minSimilarity)
        )
      )
      .orderBy(desc(similarity))
      .limit(limit);
    
    return results;
  } catch (error) {
    console.error("Error searching similar code:", error);
    throw new Error(
      `Failed to search similar code: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get full file content for specific file paths
 * Used when user explicitly asks about a file
 * 
 * @param projectId - Project ID
 * @param filePaths - Array of file paths to retrieve
 * @returns Array of file contents
 */
export async function getFilesByPath(
  projectId: string,
  filePaths: string[]
): Promise<Array<{ filePath: string; content: string; language: string | null }>> {
  try {
    const results = await db
      .select({
        filePath: projectFiles.fileName,
        content: projectFiles.code,
        language: projectFiles.language,
      })
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          inArray(projectFiles.fileName, filePaths)
        )
      );
    
    return results;
  } catch (error) {
    console.error("Error getting files by path:", error);
    throw new Error(
      `Failed to get files: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Search for a single file by path (fuzzy match)
 * 
 * @param projectId - Project ID
 * @param filePath - File path or partial path
 * @returns Matching file or null
 */
export async function searchFileByPath(
  projectId: string,
  filePath: string
): Promise<{ filePath: string; content: string; language: string | null } | null> {
  try {
    // Try exact match first
    const exactMatch = await db
      .select({
        filePath: projectFiles.fileName,
        content: projectFiles.code,
        language: projectFiles.language,
      })
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.fileName, filePath)
        )
      )
      .limit(1);
    
    if (exactMatch.length > 0) {
      return exactMatch[0];
    }
    
    // Try fuzzy match (file name only)
    const fileName = filePath.split("/").pop();
    if (fileName) {
      const fuzzyMatch = await db
        .select({
          filePath: projectFiles.fileName,
          content: projectFiles.code,
          language: projectFiles.language,
        })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            sql`${projectFiles.fileName} LIKE ${`%${fileName}%`}`
          )
        )
        .limit(1);
      
      if (fuzzyMatch.length > 0) {
        return fuzzyMatch[0];
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error searching file by path:", error);
    throw new Error(
      `Failed to search file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get project statistics for context
 * 
 * @param projectId - Project ID
 * @returns Project stats (languages, file count, etc.)
 */
export async function getProjectContext(projectId: string): Promise<{
  languages: string[];
  totalFiles: number;
  totalEmbeddings: number;
}> {
  try {
    // Get unique languages
    const languagesResult = await db
      .selectDistinct({
        language: projectFiles.language,
      })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));
    
    const languages = languagesResult
      .map((r) => r.language)
      .filter((l): l is string => l !== null && l !== "unknown");
    
    // Get file count
    const filesResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));
    
    // Get embeddings count
    const embeddingsResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(codeEmbeddings)
      .where(eq(codeEmbeddings.projectId, projectId));
    
    return {
      languages,
      totalFiles: filesResult[0]?.count || 0,
      totalEmbeddings: embeddingsResult[0]?.count || 0,
    };
  } catch (error) {
    console.error("Error getting project context:", error);
    throw new Error(
      `Failed to get project context: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Format search results for LLM context
 * Creates a formatted string of code chunks with metadata
 * 
 * @param results - Search results from vector search
 * @returns Formatted context string
 */
export async function formatRetrievedContext(results: SearchResult[]): Promise<string> {
  if (results.length === 0) {
    return "No relevant code found for this query.";
  }
  
  const formatted = results.map((result, index) => {
    return `
--- CODE CHUNK ${index + 1} ---
File: ${result.filePath}
Similarity: ${(result.similarity * 100).toFixed(1)}%
Token Count: ${result.tokenCount}

${result.chunkContent}
`;
  });
  
  return formatted.join("\n");
}

// ---------------------------------------------------------------------------
// Re-ranking
// ---------------------------------------------------------------------------

/**
 * Tokenize a query string into lowercase terms, stripping punctuation.
 */
function extractQueryTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1),
    ),
  ];
}

/**
 * Re-rank vector search results using three in-memory signals:
 *   1. Keyword boost   — +0.05 per exact query term found in chunk content
 *   2. File-path boost — +0.10 per query term found in the file path
 *   3. Diversity cap   — max 3 chunks per file to prevent one file dominating
 *
 * Returns up to `limit` results sorted by final score.
 */
export function reRankResults(
  results: SearchResult[],
  query: string,
  limit: number = 8,
): SearchResult[] {
  const terms = extractQueryTerms(query);

  const scored = results.map((r) => {
    let score = r.similarity;

    if (terms.length > 0) {
      const lowerContent = r.chunkContent.toLowerCase();
      const lowerPath = r.filePath.toLowerCase();

      for (const term of terms) {
        if (lowerContent.includes(term)) score += 0.05;
        if (lowerPath.includes(term)) score += 0.10;
      }
    }

    return { ...r, similarity: score };
  });

  // Sort descending, then enforce max-3-per-file diversity
  scored.sort((a, b) => b.similarity - a.similarity);

  const fileCounts: Record<string, number> = {};
  const diverse: SearchResult[] = [];

  for (const r of scored) {
    const count = fileCounts[r.filePath] ?? 0;
    if (count < 3) {
      fileCounts[r.filePath] = count + 1;
      diverse.push(r);
      if (diverse.length >= limit) break;
    }
  }

  return diverse;
}

// ---------------------------------------------------------------------------
// In-file vector search (for large file-specific queries)
// ---------------------------------------------------------------------------

/**
 * Search for the most relevant chunks within a single file.
 * Used when a file-specific query targets a large file (> 8000 chars).
 *
 * @param projectId - Project ID
 * @param filePath  - Exact file path to search within
 * @param queryEmbedding - Query vector
 * @param limit     - Max chunks to return (default 6)
 */
export async function searchSimilarCodeInFile(
  projectId: string,
  filePath: string,
  queryEmbedding: number[],
  limit: number = 6,
): Promise<SearchResult[]> {
  try {
    const similarity = sql<number>`1 - (${cosineDistance(codeEmbeddings.embedding, queryEmbedding)})`;

    const results = await db
      .select({
        id: codeEmbeddings.id,
        filePath: codeEmbeddings.filePath,
        chunkContent: codeEmbeddings.chunkContent,
        chunkIndex: codeEmbeddings.chunkIndex,
        tokenCount: codeEmbeddings.tokenCount,
        similarity,
      })
      .from(codeEmbeddings)
      .where(
        and(
          eq(codeEmbeddings.projectId, projectId),
          eq(codeEmbeddings.filePath, filePath),
        ),
      )
      .orderBy(desc(similarity))
      .limit(limit);

    return results;
  } catch (error) {
    console.error("Error in searchSimilarCodeInFile:", error);
    throw new Error(
      `Failed to search within file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Small-project full-context dump
// ---------------------------------------------------------------------------

const SMALL_PROJECT_TOKEN_THRESHOLD = 150_000;

/**
 * Returns true when the project qualifies for the fast "full dump" path.
 * A null estimatedTokens means the project hasn't been embedded yet — treat
 * as large (returns false) so it routes through RAG safely.
 */
export function isSmallProject(estimatedTokens: number | null): boolean {
  if (estimatedTokens === null) return false;
  return estimatedTokens < SMALL_PROJECT_TOKEN_THRESHOLD;
}

/**
 * Fetch all project files and format them as a single context string.
 * Only called on the fast path when isSmallProject() is true.
 * Files are sorted so smaller files (less noise) come first.
 */
export async function getAllProjectFilesForContext(
  projectId: string,
): Promise<string> {
  try {
    const files = await db
      .select({
        fileName: projectFiles.fileName,
        code: projectFiles.code,
        language: projectFiles.language,
      })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));

    if (files.length === 0) {
      return "No files found for this project.";
    }

    // Sort by file size ascending so important small config/type files appear first
    files.sort((a, b) => a.code.length - b.code.length);

    const formatted = files.map((f) => {
      const lang = f.language ?? f.fileName.split(".").pop() ?? "text";
      return `\`\`\`${lang}\n// File: ${f.fileName}\n${f.code}\n\`\`\``;
    });

    return formatted.join("\n\n");
  } catch (error) {
    console.error("Error fetching all project files:", error);
    throw new Error(
      `Failed to fetch project files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
