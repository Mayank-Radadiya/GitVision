import { db } from "@/db";
import {
  projectTables,
  projectFiles,
  codeEmbeddings,
  rateLimitsTable,
} from "@/db/schema";
import { eq, and, ne, sql, sum, lt } from "drizzle-orm";
import { getRepositoryFiles, syncIssuesAndComments } from "../github";
import { inngest } from "./client";
import { processFileForRag } from "@/src/features/rag/services/rag-ingestion";
import { logger } from "@/src/lib/logger";

// ---------------------------------------------------------------------------
// 1. Project Created — imports files, syncs issues, auto-triggers embeddings
// ---------------------------------------------------------------------------

export const projectCreated = inngest.createFunction(
  {
    id: "project-created",
    retries: 3,
    triggers: [{ event: "project/created" }],
  },
  async ({ event, step }) => {
    const { projectId, repoUrl, owner, repo } = event.data;

    // Step 1: Import all repository files
    await step.run("Import Files", async () => {
      logger.info(`[Inngest] Starting file import for ${projectId}`);
      await getRepositoryFiles(owner, repo, projectId);
    });

    // Step 2: Sync issues and comments
    await step.run("Sync Issues", async () => {
      logger.info(`[Inngest] Starting issue sync for ${projectId}`);
      await syncIssuesAndComments(repoUrl, projectId);
    });

    // Step 3: Finalize & auto-trigger embedding generation
    await step.run("Finalize Project", async () => {
      logger.info(`[Inngest] Finalizing project ${projectId}`);
      await db
        .update(projectTables)
        .set({ updatedAt: new Date() })
        .where(eq(projectTables.id, projectId));
    });

    // Step 4: Auto-trigger embedding generation
    await step.sendEvent("trigger-embeddings", {
      name: "embeddings/generate",
      data: { projectId },
    });

    return { success: true, projectId };
  },
);

// ---------------------------------------------------------------------------
// 2. Generate Embeddings — durable, step-based embedding pipeline
// ---------------------------------------------------------------------------

export const generateEmbeddings = inngest.createFunction(
  {
    id: "generate-embeddings",
    retries: 2,
    // Cap concurrent embedding pipelines — a burst of project creations must
    // not spawn unbounded parallel jobs against the embedding provider.
    concurrency: 2,
    // Allow up to 30 minutes for large repos
    cancelOn: [
      {
        event: "embeddings/cancel",
        match: "data.projectId",
      },
    ],
    triggers: [{ event: "embeddings/generate" }],
  },
  async ({ event, step }) => {
    const { projectId } = event.data;

    // Step 1: Atomically claim the "processing" state and load files.
    // UPDATE ... WHERE status != 'processing' RETURNING is atomic, so two
    // concurrent embeddings/generate events can't both pass the old
    // check-then-set race (TOCTOU) — the loser gets `claimed: false`.
    const prepared = await step.run("Prepare", async () => {
      const [claimed] = await db
        .update(projectTables)
        .set({
          embeddingStatus: "processing",
          embeddingProgress: 0,
          embeddingError: null,
          lastEmbeddingAttempt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projectTables.id, projectId),
            ne(projectTables.embeddingStatus, "processing"),
          ),
        )
        .returning({ id: projectTables.id });

      if (!claimed) {
        logger.info(
          `[Inngest] Embeddings already processing for ${projectId}, skipping`,
        );
        return { claimed: false, files: [] };
      }

      // We own the pipeline — load all files
      const allFiles = await db
        .select({
          id: projectFiles.id,
          fileName: projectFiles.fileName,
          code: projectFiles.code,
        })
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId));

      logger.info(
        `[Inngest] Found ${allFiles.length} files for embedding in project ${projectId}`,
      );
      return { claimed: true, files: allFiles };
    });

    if (!prepared.claimed) {
      return { success: false, projectId, reason: "already-processing" };
    }

    if (prepared.files.length === 0) {
      // We claimed the pipeline but found no files — mark failed so the
      // project isn't left stuck in "processing" forever.
      await step.run("Handle Empty", async () => {
        await db
          .update(projectTables)
          .set({
            embeddingStatus: "failed",
            embeddingError:
              "No source files found. Ensure the project has been synced from GitHub.",
            updatedAt: new Date(),
          })
          .where(eq(projectTables.id, projectId));
      });

      return { success: false, projectId, reason: "no-files" };
    }

    const files = prepared.files;

    // Step 2: Process files in batches (each batch is a durable step)
    const BATCH_SIZE = 5;
    let totalChunks = 0;
    let totalEmbeddings = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batchIndex = Math.floor(i / BATCH_SIZE);
      const batch = files.slice(i, i + BATCH_SIZE);

      const batchResult = await step.run(
        `Process Batch ${batchIndex + 1}`,
        async () => {
          let batchChunks = 0;
          let batchEmbeddings = 0;
          const batchErrors: string[] = [];

          // Process files concurrently within the batch
          const results = await Promise.all(
            batch.map((file) =>
              processFileForRag(file.id, file.fileName, file.code, projectId),
            ),
          );

          for (const result of results) {
            if (result.error) {
              batchErrors.push(`${result.filePath}: ${result.error}`);
            } else if (!result.skipped) {
              batchChunks += result.chunksProcessed;
              batchEmbeddings += result.embeddingsGenerated;
            }
          }

          // Update progress
          const progress = Math.min(
            Math.round(((i + BATCH_SIZE) / files.length) * 100),
            100,
          );

          await db
            .update(projectTables)
            .set({ embeddingProgress: progress, updatedAt: new Date() })
            .where(eq(projectTables.id, projectId));

          logger.info(
            `[Inngest] Batch ${batchIndex + 1}: ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files (${progress}%)`,
          );

          return { batchChunks, batchEmbeddings, batchErrors };
        },
      );

      totalChunks += batchResult.batchChunks;
      totalEmbeddings += batchResult.batchEmbeddings;
      errors.push(...batchResult.batchErrors);
    }

    // Step 3: Verify and finalize
    const finalResult = await step.run("Finalize", async () => {
      // Verify embeddings were stored
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(codeEmbeddings)
        .where(eq(codeEmbeddings.projectId, projectId));

      const actualCount = countResult?.count ?? 0;

      if (actualCount === 0) {
        const errorMsg = `Embedding generation produced 0 embeddings from ${files.length} files. ${
          errors.length > 0
            ? `Errors: ${errors.slice(0, 3).join("; ")}`
            : "Files may be empty or unsupported."
        }`;

        await db
          .update(projectTables)
          .set({
            embeddingStatus: "failed",
            embeddingError: errorMsg,
            embeddingProgress: 0,
            updatedAt: new Date(),
          })
          .where(eq(projectTables.id, projectId));

        return { success: false, error: errorMsg };
      }

      // Calculate total tokens for the project size gate
      const [tokenResult] = await db
        .select({ total: sum(codeEmbeddings.tokenCount) })
        .from(codeEmbeddings)
        .where(eq(codeEmbeddings.projectId, projectId));

      const estimatedTokens = Number(tokenResult?.total ?? 0);

      // Mark as completed
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

      logger.info(
        `[Inngest] ✅ Embeddings complete for ${projectId}: ${actualCount} embeddings, ${totalChunks} chunks`,
      );

      return { success: true, embeddings: actualCount };
    });

    return {
      success: finalResult.success,
      projectId,
      totalFiles: files.length,
      totalChunks,
      totalEmbeddings,
      errors: errors.length,
    };
  },
);

// ---------------------------------------------------------------------------
// 3. Cleanup Stale Data — Automated Data Retention Policy Job
// Runs daily at 03:00 AM UTC
// ---------------------------------------------------------------------------

export const cleanupStaleData = inngest.createFunction(
  {
    id: "cleanup-stale-data",
    triggers: [{ cron: "0 3 * * *" }],
  },
  async ({ step }) => {
    // 1. Purge expired rate limit windows (> 24h old)
    const rateLimitResult = await step.run(
      "Clean Expired Rate Limits",
      async () => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deleted = await db
          .delete(rateLimitsTable)
          .where(lt(rateLimitsTable.createdAt, dayAgo))
          .returning({ id: rateLimitsTable.id });

        logger.info(
          `[Retention] Cleaned ${deleted.length} expired rate limit entries`,
        );
        return { count: deleted.length };
      },
    );

    return {
      success: true,
      cleanedRateLimits: rateLimitResult.count,
    };
  },
);
