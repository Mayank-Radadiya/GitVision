import { db } from "@/db";
import {
  projectTables,
  projectFiles,
  codeEmbeddings,
  rateLimitsTable,
} from "@/db/schema";
import { eq, and, ne, sql, sum, lt, asc } from "drizzle-orm";
import { getRepositoryFiles, syncIssuesAndComments } from "../github";
import { inngest } from "./client";
import { processFileForRag } from "@/src/features/rag/services/rag-ingestion";
import { logger } from "@/src/lib/logger";
import { grantDailyCredits, DAILY_CREDIT_GRANT } from "../credits";

// Ceilings for the embedding pipeline's file load. The SQL LIMIT bounds how much
// of the repo enters memory (and the Inngest step payload); the per-file cap
// bounds what one minified bundle can do to a single ingestion call.
const MAX_EMBEDDING_FILES = 500;
const MAX_EMBEDDING_FILE_CHARS = 50_000;

// ---------------------------------------------------------------------------
// 1. Project Created — imports files, syncs issues, auto-triggers embeddings
// ---------------------------------------------------------------------------

export const projectCreated = inngest.createFunction(
  {
    id: "project-created",
    retries: 3,
    triggers: [{ event: "project/created" }],
    // Without this the project is stranded at embeddingStatus: "pending" forever,
    // because nothing else ever advances it once the retries are exhausted.
    onFailure: async ({ event, error }) => {
      const failedProjectId = event.data.event.data?.projectId;
      if (!failedProjectId) {
        logger.error(
          `[Inngest] projectCreated failed but no projectId on the event: ${error.message}`,
        );
        return;
      }
      logger.error(
        `[Inngest] projectCreated exhausted retries for ${failedProjectId}: ${error.message}`,
      );
      await db
        .update(projectTables)
        .set({
          embeddingStatus: "failed",
          embeddingError: `Project setup failed after all retries: ${error.message}`,
          lastEmbeddingAttempt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectTables.id, failedProjectId));
    },
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
    // The pipeline claims `embeddingStatus: "processing"` in its first step.
    // Without this hook, any failure that escapes a step — an exhausted retry,
    // a step timeout, or a hard crash — left the project stuck in "processing"
    // forever with no way for the UI to explain why. `onFailure` is the single
    // place every terminal failure routes through, so marking the row here
    // covers all of them at once.
    onFailure: async ({ event, error }) => {
      const failedProjectId = event.data.event.data?.projectId;

      if (!failedProjectId) {
        logger.error(
          `[Inngest] generateEmbeddings failed but no projectId on the event: ${error.message}`,
        );
        return;
      }

      logger.error(
        `[Inngest] generateEmbeddings exhausted retries for ${failedProjectId}: ${error.message}`,
      );

      await db
        .update(projectTables)
        .set({
          embeddingStatus: "failed",
          embeddingError: `Embedding job failed after all retries: ${error.message}`,
          lastEmbeddingAttempt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectTables.id, failedProjectId));
    },
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
        return { claimed: false, files: [], total: 0 };
      }

      // We own the pipeline — load the files, bounded. This result is
      // serialized into the Inngest step payload, so an unbounded read of a
      // large repo can exceed the step-output limit and lose the whole run.
      // Order by shortest first so the cap keeps the small, high-signal files
      // and slice any single body that is still oversized.
      const rows = await db
        .select({
          id: projectFiles.id,
          fileName: projectFiles.fileName,
          code: projectFiles.code,
        })
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId))
        .orderBy(asc(sql<number>`length(${projectFiles.code})`))
        .limit(MAX_EMBEDDING_FILES);

      const allFiles = rows.map((f) =>
        f.code.length > MAX_EMBEDDING_FILE_CHARS
          ? { ...f, code: `${f.code.slice(0, MAX_EMBEDDING_FILE_CHARS)}\n// ... truncated` }
          : f,
      );

      logger.info(
        `[Inngest] Found ${allFiles.length} files for embedding in project ${projectId}`,
      );

      // The bounded read above hides how many files the project actually has.
      // Count them so Finalize can tell a complete index from a capped one.
      const [countRow] = await db
        .select({ total: sql<number>`count(*)` })
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId));

      return { claimed: true, files: allFiles, total: Number(countRow?.total ?? 0) };
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
      const selectedFiles = files.length;

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

        return { success: false, error: errorMsg, truncated: false };
      }

      // Calculate total tokens for the project size gate
      const [tokenResult] = await db
        .select({ total: sum(codeEmbeddings.tokenCount) })
        .from(codeEmbeddings)
        .where(eq(codeEmbeddings.projectId, projectId));

      const estimatedTokens = Number(tokenResult?.total ?? 0);

      // "completed" is a promise that every file in the repo is searchable. If
      // any file failed or only partially embedded, say so instead — a
      // completed badge on a half-indexed project sends the user to a chat
      // answer that quietly misses files it claims to know about.
      if (errors.length > 0) {
        const errorMsg = `Indexed ${actualCount} embeddings but ${errors.length} file(s) failed. ${errors
          .slice(0, 3)
          .join("; ")}`;

        await db
          .update(projectTables)
          .set({
            embeddingStatus: "failed",
            embeddingError: errorMsg,
            embeddingProgress: 100,
            estimatedTokens,
            updatedAt: new Date(),
          })
          .where(eq(projectTables.id, projectId));

        logger.error(`[Inngest] ⚠️ Embeddings incomplete for ${projectId}: ${errors.length} file error(s)`);

        return { success: false, embeddings: actualCount, error: errorMsg, truncated: false };
      }

      // The same promise breaks a different way when the project is simply
      // bigger than the cap: Prepare only ever sees the MAX_EMBEDDING_FILES
      // smallest files, so "completed" would advertise coverage of files that
      // were never embedded and never will be on a re-run. A partial index is
      // still a working index, so it is not "failed" — but it is not the whole
      // repo either, and the user has to be told which half they got.
      if (prepared.total > selectedFiles) {
        const truncatedMsg = `Indexed ${selectedFiles} of ${prepared.total} files — the repository exceeds the ${MAX_EMBEDDING_FILES}-file embedding cap, so the remaining ${
          prepared.total - selectedFiles
        } files are not searchable.`;

        await db
          .update(projectTables)
          .set({
            embeddingStatus: "partial",
            embeddingProgress: 100,
            embeddingError: truncatedMsg,
            estimatedTokens,
            updatedAt: new Date(),
          })
          .where(eq(projectTables.id, projectId));

        logger.warn(
          `[Inngest] ⚠️ Partial index for ${projectId}: ${selectedFiles}/${prepared.total} files embedded`,
        );

        return { success: true, embeddings: actualCount, truncated: true };
      }

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

      return { success: true, embeddings: actualCount, truncated: false };
    });

    return {
      success: finalResult.success,
      projectId,
      totalFiles: files.length,
      totalProjectFiles: prepared.total,
      truncated: finalResult.truncated,
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
    // Cron-triggered, so there is no project to write status to. The failure
    // still has to be visible somewhere, otherwise a broken sweep looks like a
    // healthy one.
    onFailure: async ({ error }) => {
      logger.error(
        `[Inngest] cleanupStaleData failed: ${error.message}`,
      );
    },
  },
  async ({ step }) => {
    // 1. Purge expired rate limit windows.
    // rate_limits has no createdAt/id column — windowStart is the only
    // timestamp, and a rate limit row is dead once its window has elapsed.
    //
    // A row may only be dropped after the LONGEST window any caller uses, or
    // rateLimit() would have to resurrect it from scratch mid-count. The
    // longest configured window is 3600s (projectCreate); the other two are
    // 600s (embeddings) and 60s (chat). Keep this >= that, and re-check the
    // rateLimit() call sites when adding a new limit.
    const RATE_LIMIT_MAX_WINDOW_SECONDS = 3600;

    const rateLimitResult = await step.run(
      "Clean Expired Rate Limits",
      async () => {
        const cutoff = new Date(
          Date.now() - RATE_LIMIT_MAX_WINDOW_SECONDS * 1000,
        );
        const deleted = await db
          .delete(rateLimitsTable)
          .where(lt(rateLimitsTable.windowStart, cutoff))
          .returning({ limitKey: rateLimitsTable.limitKey });

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

// ---------------------------------------------------------------------------
// 4. Daily Credit Grant — Free-tier top-up, runs daily at 00:00 UTC
// ---------------------------------------------------------------------------

/**
 * The free tier is a 100-credit signup grant and nothing else, so a user who
 * exhausts it has no way back in short of paying. This tops every account below
 * the ceiling back up a little each day, and `credits.claim` (the sidebar
 * button) lets a user take the rest immediately rather than waiting out the
 * drip.
 *
 * Both paths write the same kind of ledger row, so the two are independently
 * idempotent rather than competing: the cron keys on `daily:<date>:<user_id>`
 * and the claim on `claim:<user_id>:<date>`, and each is rejected only by its own
 * key. A user can therefore receive both on the same day, which is intended —
 * they are two separate entitlements, not two attempts at one.
 *
 * Note the asymmetry with `cleanupStaleData`: this grants to every account
 * holding a `users` row, including ones that have never logged in since signup.
 * There is no `is_pro_user` to filter on (dropped in 0007) and no per-user
 * opt-out, so the sweep's cost scales with total accounts rather than active
 * ones. `grantDailyCredits` writes no row for an account already at the ceiling,
 * which bounds the damage to a `SELECT` over those accounts.
 */
export const dailyCreditGrant = inngest.createFunction(
  {
    id: "daily-credit-grant",
    triggers: [{ cron: "0 0 * * *" }],
    // Same reasoning as cleanupStaleData: a cron has no row to write status to,
    // so a silent failure would look identical to a healthy sweep that granted
    // nobody. Log loudly instead.
    onFailure: async ({ error }) => {
      logger.error(`[Inngest] dailyCreditGrant failed: ${error.message}`);
    },
  },
  async ({ step }) => {
    return step.run("Grant Daily Credits", async () => {
      // The date lives in the key, not just in the cron schedule. Inngest can
      // retry a step, and a retry that reused a fresh key would double-grant;
      // pinning the date means a retry on the same UTC day collides with the
      // rows the first attempt already wrote and the unique index rejects them.
      const prefix = `daily:${new Date().toISOString().slice(0, 10)}:`;
      const { granted } = await grantDailyCredits(prefix);

      logger.info(
        `[Credits] Daily grant: ${granted} account(s) received ${DAILY_CREDIT_GRANT} credits`,
      );

      return { granted };
    });
  },
);
