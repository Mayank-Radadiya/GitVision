/**
 * Code ingestion pipeline for RAG
 * Processes project files, chunks them, generates embeddings, and stores in database
 */

import { db } from "@/db";
import { projectFiles, projectTables, codeEmbeddings } from "@/db/schema";
import { eq, sql, sum } from "drizzle-orm";
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

    // Chunk the code
    const chunks = chunkCode(code, filePath, 400, 50);

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
 * Process all files for a project
 * Called when user selects project for chat (deferred processing)
 */
export async function processProjectForRag(
  projectId: string,
  onProgress?: (progress: number, current: number, total: number) => void,
): Promise<{
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  totalEmbeddings: number;
  errors: string[];
}> {
  try {
    console.log(`[RAG] ========================================`);
    console.log(
      `[RAG] Starting embedding generation for project: ${projectId}`,
    );
    console.log(`[RAG] ========================================`);

    // Update status to processing
    await db
      .update(projectTables)
      .set({
        embeddingStatus: "processing",
        embeddingProgress: 0,
        lastEmbeddingAttempt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectTables.id, projectId));

    console.log(`[RAG] Status updated to 'processing'`);

    // Get all files for this project
    const files = await db
      .select({
        id: projectFiles.id,
        fileName: projectFiles.fileName,
        code: projectFiles.code,
      })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));

    console.log(`[RAG] Found ${files.length} files to process`);
    console.log(`[RAG] Processing in batches of 5 files...`);

    let processedFiles = 0;
    let totalChunks = 0;
    let totalEmbeddings = 0;
    const errors: string[] = [];

    // Process files in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      // Process batch concurrently
      const batchPromises = batch.map((file) =>
        processFileForRag(file.id, file.fileName, file.code, projectId),
      );

      const results = await Promise.all(batchPromises);

      // Aggregate results
      for (const result of results) {
        if (result.error) {
          errors.push(`${result.filePath}: ${result.error}`);
        } else if (!result.skipped) {
          processedFiles++;
          totalChunks += result.chunksProcessed;
          totalEmbeddings += result.embeddingsGenerated;
        }
      }

      // Calculate and update progress
      const currentProgress = Math.min(
        Math.round(((i + batchSize) / files.length) * 100),
        100,
      );

      // Update progress in database
      await db
        .update(projectTables)
        .set({
          embeddingProgress: currentProgress,
          updatedAt: new Date(),
        })
        .where(eq(projectTables.id, projectId));

      // Call progress callback if provided
      if (onProgress) {
        onProgress(
          currentProgress,
          Math.min(i + batchSize, files.length),
          files.length,
        );
      }

      // Log progress
      console.log(
        `[RAG] Progress: ${Math.min(i + batchSize, files.length)}/${files.length} files (${currentProgress}%) | Chunks: ${totalChunks} | Embeddings: ${totalEmbeddings}`,
      );

      // Add delay between batches to respect rate limits
      if (i + batchSize < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(`[RAG] ========================================`);
    console.log(`[RAG] Embedding generation COMPLETED!`);
    console.log(`[RAG] Files processed: ${processedFiles}`);
    console.log(`[RAG] Total chunks: ${totalChunks}`);
    console.log(`[RAG] Total embeddings: ${totalEmbeddings}`);
    console.log(`[RAG] Errors: ${errors.length}`);
    console.log(`[RAG] ========================================`);

    // Calculate total token count across all embeddings for the project size gate
    const tokenSumResult = await db
      .select({ total: sum(codeEmbeddings.tokenCount) })
      .from(codeEmbeddings)
      .where(eq(codeEmbeddings.projectId, projectId));

    const estimatedTokens = Number(tokenSumResult[0]?.total ?? 0);

    // Update status to completed
    await db
      .update(projectTables)
      .set({
        embeddingStatus: "completed",
        embeddingProgress: 100,
        embeddingError: null,
        estimatedTokens,
        updatedAt: new Date(),
      })
      .where(eq(projectTables.id, projectId));

    console.log(
      `Project ${projectId} processing complete: ${processedFiles} files, ${totalChunks} chunks, ${totalEmbeddings} embeddings`,
    );

    return {
      totalFiles: files.length,
      processedFiles,
      totalChunks,
      totalEmbeddings,
      errors,
    };
  } catch (error) {
    console.error(`Error processing project ${projectId}:`, error);

    await db
      .update(projectTables)
      .set({
        embeddingStatus: "failed",
        embeddingError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      })
      .where(eq(projectTables.id, projectId));

    throw new Error(
      `Failed to process project: ${error instanceof Error ? error.message : String(error)}`,
    );
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
