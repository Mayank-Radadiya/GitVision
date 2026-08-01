import { db } from "@/db";
import { projectTables, projectFiles, codeEmbeddings } from "@/db/schema";
import { eq, sql, sum } from "drizzle-orm";
import { getRepositoryFiles, syncIssuesAndComments } from "../github";
import { inngest } from "./client";
import { processFileForRag } from "@/src/features/rag/services/rag-ingestion";

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
      console.log(`[Inngest] Starting file import for ${projectId}`);
      await getRepositoryFiles(owner, repo, projectId);
    });

    // Step 2: Sync issues and comments
    await step.run("Sync Issues", async () => {
      console.log(`[Inngest] Starting issue sync for ${projectId}`);
      await syncIssuesAndComments(repoUrl, projectId);
    });

    // Step 3: Finalize & auto-trigger embedding generation
    await step.run("Finalize Project", async () => {
      console.log(`[Inngest] Finalizing project ${projectId}`);
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

    // Step 1: Mark as processing and load files
    const files = await step.run("Prepare", async () => {
      // Check if already processing (prevent duplicate runs)
      const [project] = await db
        .select({ embeddingStatus: projectTables.embeddingStatus })
        .from(projectTables)
        .where(eq(projectTables.id, projectId))
        .limit(1);

      if (project?.embeddingStatus === "processing") {
        console.log(
          `[Inngest] Embeddings already processing for ${projectId}, skipping`,
        );
        return [];
      }

      // Update status to processing
      await db
        .update(projectTables)
        .set({
          embeddingStatus: "processing",
          embeddingProgress: 0,
          embeddingError: null,
          lastEmbeddingAttempt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectTables.id, projectId));

      // Load all files
      const allFiles = await db
        .select({
          id: projectFiles.id,
          fileName: projectFiles.fileName,
          code: projectFiles.code,
        })
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId));

      console.log(
        `[Inngest] Found ${allFiles.length} files for embedding in project ${projectId}`,
      );
      return allFiles;
    });

    if (files.length === 0) {
      // Could be "already processing" or no files — check which
      await step.run("Handle Empty", async () => {
        const [project] = await db
          .select({ embeddingStatus: projectTables.embeddingStatus })
          .from(projectTables)
          .where(eq(projectTables.id, projectId))
          .limit(1);

        if (project?.embeddingStatus === "processing") {
          // Already running elsewhere — just return
          return;
        }

        // No files at all
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

          console.log(
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

      console.log(
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
