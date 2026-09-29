/**
 * Vector similarity search for code embeddings
 * Performs cosine similarity search on code chunks
 */

import { db } from "@/db";
import { codeEmbeddings, projectFiles } from "@/db/schema";
import { cosineDistance, sql, eq, and, asc } from "drizzle-orm";
import { estimateTokens, fitToBudget } from "@/src/lib/llm/budget";
import { logger } from "@/src/lib/logger";

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
  minSimilarity: number = 0.7,
): Promise<SearchResult[]> {
  try {
    // Work in cosine *distance* space, which is what `embeddings_vector_idx`
    // (hnsw ... vector_cosine_ops) is built on. Ordering by `1 - distance` —
    // the `similarity` alias — is the form pgvector documents as index-defeating,
    // because `1 - x` is not a vector operator. Measured on a 20k-row HNSW probe
    // table, that form is ~13x slower (index scan -> top-N sort -> bitmap scan).
    //
    // A distance threshold in WHERE is *not* the problem the index sees — pg applies
    // it as a post-`Filter` inside the HNSW scan at no extra cost. The real cost is
    // starvation: that filter discards rows after the index has already produced its
    // `limit`, so a selective threshold silently returns far fewer results than asked
    // (measured: 1 row for LIMIT 8). Over-fetch a fixed candidate pool and threshold
    // in JS so a narrow query can still fill `limit`.
    const distance = cosineDistance(codeEmbeddings.embedding, queryEmbedding);
    const similarity = sql<number>`1 - (${distance})`;
    const candidatePool = Math.max(limit * 4, 32);

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
      .where(eq(codeEmbeddings.projectId, projectId))
      .orderBy(asc(distance))
      .limit(candidatePool);

    return results
      .filter((result) => Number(result.similarity) >= minSimilarity)
      .slice(0, limit);
  } catch (error) {
    logger.error("Error searching similar code", error);
    throw new Error(
      `Failed to search similar code: ${error instanceof Error ? error.message : String(error)}`,
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
  const [languagesResult, filesResult, embeddingsResult] = await Promise.all([
    db
      .selectDistinct({ language: projectFiles.language })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(codeEmbeddings)
      .where(eq(codeEmbeddings.projectId, projectId)),
  ]);

  const languages = languagesResult
    .map((r) => r.language)
    .filter((l): l is string => l !== null && l !== "unknown");

  return {
    languages,
    totalFiles: filesResult[0]?.count || 0,
    totalEmbeddings: embeddingsResult[0]?.count || 0,
  };
}

/**
 * Format search results for LLM context
 * Creates a formatted string of code chunks with metadata
 *
 * @param results - Search results from vector search
 * @param maxTokens - Optional token budget for formatted context
 * @returns Formatted context string
 */
export function formatRetrievedContext(
  results: SearchResult[],
  maxTokens?: number,
): string {
  if (results.length === 0) {
    return "No relevant code found for this query.";
  }

  let items = results.map((result, index) => {
    const text = `
--- CODE CHUNK ${index + 1} ---
File: ${result.filePath}
Similarity: ${(result.similarity * 100).toFixed(1)}%
Token Count: ${result.tokenCount}

${result.chunkContent}
`;
    return { text, approxTokens: result.tokenCount || estimateTokens(text) };
  });

  if (maxTokens !== undefined && maxTokens > 0) {
    const fit = fitToBudget(items, maxTokens);
    items = fit.included;
  }

  if (items.length === 0) {
    return "No relevant code found for this query.";
  }

  return items.map((i) => i.text).join("\n");
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
        if (lowerPath.includes(term)) score += 0.1;
      }
    }

    return { ...r, similarity: score };
  });

  // Sort descending, then enforce max-3-per-file diversity
  scored.sort((a, b) => b.similarity - a.similarity);

  const fileCounts: Record<string, number> = {};
  const diverse: SearchResult[] = [];
  const capped: SearchResult[] = [];

  for (const r of scored) {
    if (diverse.length >= limit) break;
    const count = fileCounts[r.filePath] ?? 0;
    if (count < 3) {
      fileCounts[r.filePath] = count + 1;
      diverse.push(r);
    } else {
      capped.push(r);
    }
  }

  // The cap is a preference, not a quota. If it left us short of `limit`, fill the
  // remaining slots from the over-represented files in score order — a narrower
  // answer helps nobody, and 2 files x 3 chunks must not shrink an 8-result page to 6.
  for (const r of capped) {
    if (diverse.length >= limit) break;
    diverse.push(r);
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
    // Same distance-space ordering as searchSimilarCode — see the note there
    // on why `ORDER BY 1 - distance` would bypass the HNSW index.
    const distance = cosineDistance(codeEmbeddings.embedding, queryEmbedding);
    const similarity = sql<number>`1 - (${distance})`;

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
      .orderBy(asc(distance))
      .limit(limit);

    return results;
  } catch (error) {
    logger.error("Error in searchSimilarCodeInFile", error);
    throw new Error(
      `Failed to search within file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Small-project full-context dump
// ---------------------------------------------------------------------------

const SMALL_PROJECT_TOKEN_THRESHOLD = 150_000;

// Ceilings for the full-dump path. The SQL LIMIT bounds how much of the repo we
// pull into memory; the per-file cap bounds what one row can do to the prompt,
// because fitToBudget cuts on file boundaries and so never trims an oversized
// file on its own. 50k chars is ~12.5k tokens at the 4 chars/token estimate —
// two such files already fill a 32k budget, so this is generous but not fatal.
const MAX_CONTEXT_FILES = 500;
const MAX_FILE_CHARS = 50_000;

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
 *
 * @param projectId - Project ID
 * @param maxTokens - Optional budget limit for context dump
 */
export async function getAllProjectFilesForContext(
  projectId: string,
  maxTokens?: number,
): Promise<string> {
  try {
    const files = await db
      .select({
        fileName: projectFiles.fileName,
        code: projectFiles.code,
        language: projectFiles.language,
      })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId))
      .orderBy(asc(sql<number>`length(${projectFiles.code})`))
      .limit(MAX_CONTEXT_FILES);

    if (files.length === 0) {
      return "No files found for this project.";
    }

    let items = files.map((f) => {
      const lang = f.language ?? f.fileName.split(".").pop() ?? "text";
      const code =
        f.code.length > MAX_FILE_CHARS
          ? `${f.code.slice(0, MAX_FILE_CHARS)}\n// ... truncated`
          : f.code;
      const text = `\`\`\`${lang}\n// File: ${f.fileName}\n${code}\n\`\`\``;
      return { text, approxTokens: estimateTokens(text) };
    });

    if (maxTokens !== undefined && maxTokens > 0) {
      const fit = fitToBudget(items, maxTokens);
      items = fit.included;
    }

    if (items.length === 0) {
      return "No files could be fitted within the budget for this project.";
    }

    return items.map((i) => i.text).join("\n\n");
  } catch (error) {
    logger.error("Error fetching all project files", error);
    throw new Error(
      `Failed to fetch project files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
