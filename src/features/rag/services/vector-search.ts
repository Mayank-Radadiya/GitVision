/**
 * Vector similarity search for code embeddings
 * Performs cosine similarity search on code chunks
 */

"use server";

import { db } from "@/drizzle";
import { codeEmbeddings, projectFiles } from "@/drizzle/schema/schema";
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
