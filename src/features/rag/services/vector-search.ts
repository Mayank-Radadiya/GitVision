/**
 * Vector similarity search for code embeddings
 * Performs cosine similarity search on code chunks
 */

import { db } from "@/db";
import { codeEmbeddings, projectFiles } from "@/db/schema";
import { cosineDistance, sql, eq, and, asc } from "drizzle-orm";
import { estimateTokens, fitToBudget } from "@/src/lib/llm/budget";
import { logger } from "@/src/lib/logger";
import { RAG_CONFIG } from "@/src/lib/rag/rag.config";

export interface SearchResult {
  id: string;
  filePath: string;
  chunkContent: string;
  chunkIndex: number;
  tokenCount: number;
  similarity: number;
}

/** Reciprocal Rank Fusion constant. The paper's k; 60 is the published default. */
const RRF_K = 60;

/**
 * Merge ranked lists with Reciprocal Rank Fusion: score(d) = sum over lists of
 * 1 / (k + rank). Ranking is by position, not by any score, so cosine scores
 * and FTS rank scores never have to be put on a common scale.
 */
function reciprocalRankFusion(lists: SearchResult[][]): SearchResult[] {
  const merged = new Map<string, { result: SearchResult; score: number }>();
  for (const list of lists) {
    list.forEach((result, index) => {
      const contribution = 1 / (RRF_K + index + 1);
      const existing = merged.get(result.id);
      if (existing) {
        existing.score += contribution;
        return;
      }
      merged.set(result.id, { result, score: contribution });
    });
  }
  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.result);
}

/**
 * Hybrid search: dense cosine similarity fused with PostgreSQL full-text search.
 *
 * Dense alone misses exact technical identifiers — a function name, a Postgres
 * error code, a package name — because the chunk embedding of a one-token query
 * lands nowhere near the chunk embedding of the file it lives in. The sparse half
 * is a GIN-indexed `websearch_to_tsquery` lookup on `chunk_content_tsv`, which
 * finds those chunks lexically.
 *
 * @param projectId - Project to search within
 * @param queryEmbedding - Vector embedding of the search query
 * @param query - Raw query text, for the sparse half. Omit to run dense only.
 * @param limit - Target result count; the return is the candidate budget (see below)
 * @param minSimilarity - Dense-only cosine floor 0-1 (default: 0.7)
 * @returns Fused candidates ordered by RRF score. `similarity` stays the true
 *   cosine value, because reRankResults and formatRetrievedContext both read it
 *   as a 0-1 relevance number.
 */
export async function searchSimilarCode(
  projectId: string,
  queryEmbedding: number[],
  query?: string,
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

    const columns = {
      id: codeEmbeddings.id,
      filePath: codeEmbeddings.filePath,
      chunkContent: codeEmbeddings.chunkContent,
      chunkIndex: codeEmbeddings.chunkIndex,
      tokenCount: codeEmbeddings.tokenCount,
      similarity: similarity,
    };

    const denseResults = await db
      .select(columns)
      .from(codeEmbeddings)
      .where(eq(codeEmbeddings.projectId, projectId))
      .orderBy(asc(distance))
      .limit(candidatePool);

    const dense = denseResults.filter(
      (result) => Number(result.similarity) >= minSimilarity,
    );

    if (!query) {
      return dense.slice(0, limit);
    }

    // `websearch_to_tsquery` over `plainto_tsquery` because it never throws on
    // user text: quotes, `-`, `:`, `or` are operator-ish to the plain parser.
    const tsQuery = sql`websearch_to_tsquery('english', ${query})`;

    const sparseResults = await db
      .select(columns)
      .from(codeEmbeddings)
      .where(
        and(
          eq(codeEmbeddings.projectId, projectId),
          sql`${codeEmbeddings.chunkContentTsv} @@ ${tsQuery}`,
        ),
      )
      .orderBy(sql`desc(ts_rank(${codeEmbeddings.chunkContentTsv}, ${tsQuery}))`)
      .limit(candidatePool);

    // `minSimilarity` gates the dense list only. A sparse-only hit is by
    // definition a low-cosine chunk — usually exactly the identifier lookup the
    // dense half dropped — so flooring the merged output on cosine would delete
    // the rows this function exists to recover.
    // ponytail: sparse hits are admitted on FTS match alone; add a ts_rank
    // floor or a cross-encoder pre-filter if lexical noise shows up in practice.
    return reciprocalRankFusion([dense, sparseResults]).slice(0, candidatePool);
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
//
// Thresholds live in RAG_CONFIG (T-083) so the dump path and the token budget
// cannot drift apart. See src/lib/rag/rag.config.ts.
// ---------------------------------------------------------------------------

/**
 * Returns true when the project qualifies for the fast "full dump" path.
 * A null estimatedTokens means the project hasn't been embedded yet — treat
 * as large (returns false) so it routes through RAG safely.
 */
export function isSmallProject(estimatedTokens: number | null): boolean {
  if (estimatedTokens === null) return false;
  return estimatedTokens < RAG_CONFIG.smallProjectTokenThreshold;
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
      .limit(RAG_CONFIG.maxContextFiles);

    if (files.length === 0) {
      return "No files found for this project.";
    }

    let items = files.map((f) => {
      const lang = f.language ?? f.fileName.split(".").pop() ?? "text";
      const code =
        f.code.length > RAG_CONFIG.maxFileChars
          ? `${f.code.slice(0, RAG_CONFIG.maxFileChars)}\n// ... truncated`
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
