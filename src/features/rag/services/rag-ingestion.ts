/**
 * Code ingestion pipeline for RAG
 * Processes project files, chunks them, generates embeddings, and stores in database
 */

import { db } from "@/db";
import { projectFiles, codeEmbeddings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { chunkCode, computeHash, detectLanguage } from "./code-chunker";
import {
  generateEmbeddingsBatch,
  preprocessCodeForEmbedding,
} from "./embeddings";

export interface IngestionResult {
  fileId: string;
  filePath: string;
  chunksProcessed: number;
  embeddingsGenerated: number;
  skipped: boolean;
  error?: string;
}

/**
 * Process a single file: chunk it, generate embeddings, and store in database
 * Uses hash-based change detection to skip unchanged files
 */
export async function processFileForRag(
  fileId: string,
  filePath: string,
  code: string,
  projectId: string,
): Promise<IngestionResult> {
  try {
    console.log(`[RAG-FILE] Processing: ${filePath}`);

    // Compute hash for change detection
    const currentHash = computeHash(code);

    // Check if embeddings already exist for this file
    const existingEmbeddings = await db
      .select({ id: codeEmbeddings.id })
      .from(codeEmbeddings)
      .where(eq(codeEmbeddings.fileId, fileId))
      .limit(1);

    // Check file hash
    const existingFile = await db
      .select({ hash: projectFiles.hash })
      .from(projectFiles)
      .where(eq(projectFiles.id, fileId))
      .limit(1);

    // Skip ONLY if hash matches AND embeddings exist
    if (
      existingFile.length > 0 &&
      existingFile[0].hash === currentHash &&
      existingEmbeddings.length > 0
    ) {
      // File hasn't changed and embeddings exist, skip processing
      console.log(`[RAG-FILE] ⏭️  Skipping ${filePath} (unchanged)`);
      return {
        fileId,
        filePath,
        chunksProcessed: 0,
        embeddingsGenerated: 0,
        skipped: true,
      };
    }

    console.log(`[RAG-FILE] 🔄 Generating embeddings for: ${filePath}`);

    // Detect language
    const language = detectLanguage(filePath);

    // Update file record with hash and language
    await db
      .update(projectFiles)
      .set({
        hash: currentHash,
        language: language || "unknown",
        updatedAt: new Date(),
      })
      .where(eq(projectFiles.id, fileId));

    // Delete old embeddings for this file (if re-processing)
    await db.delete(codeEmbeddings).where(eq(codeEmbeddings.fileId, fileId));

    // Chunk the code (overlap 100 = the chunkCode default; 50 would create
    // inconsistent chunk boundaries vs. other callers)
    const chunks = chunkCode(code, filePath, 400, 100);

    if (chunks.length === 0) {
      return {
        fileId,
        filePath,
        chunksProcessed: 0,
        embeddingsGenerated: 0,
        skipped: false,
      };
    }

    // Prepare chunks for embedding with context
    const chunksForEmbedding = chunks.map((chunk, index) => ({
      content: preprocessCodeForEmbedding(chunk.content, filePath, chunk.type),
      index,
    }));

    // Generate embeddings in batches
    const embeddingsResults = await generateEmbeddingsBatch(chunksForEmbedding);

    // Create embedding records
    const embeddingRecords = embeddingsResults.map((result) => {
      const chunk = chunks[result.index];
      return {
        projectId,
        fileId,
        filePath,
        chunkIndex: result.index,
        chunkContent: chunk.content,
        embedding: result.embedding,
        tokenCount: chunk.tokenCount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    // Store embeddings in database (batch insert)
    if (embeddingRecords.length > 0) {
      // Insert in batches of 100 to avoid query size limits
      const batchSize = 100;
      for (let i = 0; i < embeddingRecords.length; i += batchSize) {
        const batch = embeddingRecords.slice(i, i + batchSize);
        await db.insert(codeEmbeddings).values(batch);
      }
    }

    console.log(
      `[RAG-FILE] ✓ ${filePath}: ${chunks.length} chunks, ${embeddingsResults.length} embeddings`,
    );

    return {
      fileId,
      filePath,
      chunksProcessed: chunks.length,
      embeddingsGenerated: embeddingsResults.length,
      skipped: false,
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return {
      fileId,
      filePath,
      chunksProcessed: 0,
      embeddingsGenerated: 0,
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if a project has been processed for RAG
 */
export async function isProjectProcessed(projectId: string): Promise<boolean> {
  const embeddings = await db
    .select({ count: sql<number>`count(*)` })
    .from(codeEmbeddings)
    .where(eq(codeEmbeddings.projectId, projectId))
    .limit(1);

  return embeddings.length > 0 && embeddings[0].count > 0;
}

/**
 * Get processing status for a project
 */
export async function getProjectProcessingStatus(projectId: string): Promise<{
  totalFiles: number;
  processedFiles: number;
  totalEmbeddings: number;
}> {
  const [filesCount, embeddingsCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(codeEmbeddings)
      .where(eq(codeEmbeddings.projectId, projectId)),
  ]);

  const totalFiles = filesCount[0]?.count || 0;
  const totalEmbeddings = embeddingsCount[0]?.count || 0;

  // Count files with embeddings (processed files)
  const processedFilesResult = await db
    .select({ count: sql<number>`count(distinct ${codeEmbeddings.fileId})` })
    .from(codeEmbeddings)
    .where(eq(codeEmbeddings.projectId, projectId));

  const processedFiles = processedFilesResult[0]?.count || 0;

  return {
    totalFiles,
    processedFiles,
    totalEmbeddings,
  };
}
