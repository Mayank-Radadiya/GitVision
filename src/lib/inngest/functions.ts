import { db } from "@/db";
import {
  projectTables,
  projectFiles,
  codeEmbeddings,
  rateLimitsTable,
} from "@/db/schema";
import { eq, and, ne, sql, sum, lt, asc, isNull, or, gt, inArray } from "drizzle-orm";
import {
  getRepositoryFiles,
  syncIssuesAndComments,
  resyncRepositoryFiles,
} from "../github";
import { parseGitHubUrl } from "../github/utils";
import { inngest } from "./client";
import pLimit from "p-limit";
import { processFileForRag } from "@/src/features/rag/services/rag-ingestion";
import { generateRepoBriefing } from "@/src/features/rag/services/rag/briefing-generator";
import { logger } from "@/src/lib/logger";
import { grantDailyCredits, DAILY_CREDIT_GRANT } from "../credits";
import {
  claimIndexing,
  completeIndexing,
  failAbandonedIndexing,
  failIndexing,
  partiallyCompleteIndexing,
  publishIndexingProgress,
  publishIndexingScope,
} from "@/src/lib/indexing-state";
import { isIndexingInFlight } from "@/src/lib/indexing-status";

// Ceilings for the embedding pipeline's file load. The SQL LIMIT bounds how much
// of the repo enters memory (and the Inngest step payload); the per-file cap
// bounds what one minified bundle can do to a single ingestion call.
const MAX_EMBEDDING_FILES = 500;
const MAX_EMBEDDING_FILE_CHARS = 50_000;

// Batching knobs. Each batch is its own durable step, so a single bad file
// cannot lose the whole run; running several batches at once shortens wall-clock
// on large repos. Concurrency is capped so we don't stampede the embedding
// provider's rate limit.
const EMBEDDING_BATCH_SIZE = Number(process.env.EMBEDDING_BATCH_SIZE) || 5;
const EMBEDDING_BATCH_CONCURRENCY =
  Number(process.env.EMBEDDING_BATCH_CONCURRENCY) || 3;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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
      await failAbandonedIndexing(
        failedProjectId,
        `Project setup failed after all retries: ${error.message}`,
      );
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

      await failAbandonedIndexing(
        failedProjectId,
        `Embedding job failed after all retries: ${error.message}`,
      );
    },
  },
  async ({ event, step }) => {
    const { projectId } = event.data;

    // Step 1: Claim the pipeline and load files.
    //
    // `claimIndexing` is a single conditional UPDATE, so two concurrent
    // embeddings/generate events can't both pass an old check-then-set race
    // (TOCTOU) — the loser gets `false` and returns without touching anything.
    const prepared = await step.run("Prepare", async () => {
      const claimed = await claimIndexing(projectId);

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

      const total = Number(countRow?.total ?? 0);

      // Publish the denominator so the SSE stream can render "N of M" while
      // the batches are still running. `totalFileCount` is the uncapped
      // project file count — the same number Finalize uses to decide whether
      // the run was capped.
      await publishIndexingScope(projectId, total);

      return { claimed: true, files: allFiles, total };
    });

    if (!prepared.claimed) {
      return { success: false, projectId, reason: "already-processing" };
    }

    if (prepared.files.length === 0) {
      // We claimed the pipeline but found no files — mark failed so the
      // project isn't left stuck in "processing" forever.
      await step.run("Handle Empty", async () => {
        await failIndexing(
          projectId,
          "No source files found. Ensure the project has been synced from GitHub.",
        );
      });

      return { success: false, projectId, reason: "no-files" };
    }

    const files = prepared.files;

    // Step 2: Process files in batches (each batch is a durable step).
    // Batches run EMBEDDING_BATCH_CONCURRENCY at a time; the step bodies are
    // unchanged, so a batch that fails is still retried on its own.
    let totalChunks = 0;
    let totalEmbeddings = 0;
    const errors: string[] = [];
    let completedBatches = 0;
    const limit = pLimit(EMBEDDING_BATCH_CONCURRENCY);

    await Promise.all(
      chunk(files, EMBEDDING_BATCH_SIZE).map((batch, batchIndex) =>
        limit(async () => {
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

              return { batchChunks, batchEmbeddings, batchErrors };
            },
          );

          totalChunks += batchResult.batchChunks;
          totalEmbeddings += batchResult.batchEmbeddings;
          errors.push(...batchResult.batchErrors);

          // Progress is published here rather than inside the step: batches
          // finish out of order, so deriving it from the loop index would let
          // a late batch 1 overwrite batch 3's higher count. Counting completed
          // batches keeps it monotonic. This is a running estimate; Finalize
          // overwrites it with the authoritative count.
          completedBatches++;
          const attempted = Math.min(
            completedBatches * EMBEDDING_BATCH_SIZE,
            files.length,
          );
          const progress = Math.min(
            Math.round((attempted / files.length) * 100),
            100,
          );
          const indexed = Math.max(0, attempted - errors.length);

          await publishIndexingProgress(projectId, { percent: progress, indexedFileCount: indexed });

          logger.info(
            `[Inngest] Batch ${batchIndex + 1}: ${attempted}/${files.length} files (${progress}%)`,
          );
        }),
      ),
    );

    // Step 3: Verify and finalize
    const finalResult = await step.run("Finalize", async () => {
      // Verify embeddings were stored
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(codeEmbeddings)
        .where(eq(codeEmbeddings.projectId, projectId));

      const actualCount = countResult?.count ?? 0;
      const selectedFiles = files.length;
      // Authoritative final count. The batch loop publishes a running estimate;
      // this is the number the UI keeps once the run ends.
      const indexedFiles = Math.max(0, selectedFiles - errors.length);

      if (actualCount === 0) {
        const errorMsg = `Embedding generation produced 0 embeddings from ${files.length} files. ${
          errors.length > 0
            ? `Errors: ${errors.slice(0, 3).join("; ")}`
            : "Files may be empty or unsupported."
        }`;

        await failIndexing(projectId, errorMsg, {
          progress: 0,
          indexedFileCount: 0,
          estimatedTokens: 0,
        });

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

        await failIndexing(projectId, errorMsg, {
          progress: 100,
          indexedFileCount: indexedFiles,
          estimatedTokens,
        });

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

        await partiallyCompleteIndexing(
          projectId,
          { indexedFileCount: indexedFiles, estimatedTokens },
          truncatedMsg,
        );

        logger.warn(
          `[Inngest] ⚠️ Partial index for ${projectId}: ${selectedFiles}/${prepared.total} files embedded`,
        );

        return { success: true, embeddings: actualCount, truncated: true };
      }

      // Mark as completed
      await completeIndexing(projectId, {
        indexedFileCount: indexedFiles,
        estimatedTokens,
      });

      logger.info(
        `[Inngest] ✅ Embeddings complete for ${projectId}: ${actualCount} embeddings, ${totalChunks} chunks`,
      );

      return { success: true, embeddings: actualCount, truncated: false };
    });

    // Step 4: Synthesize the plain-language briefing shown at the top of the
    // Overview tab (F-15). Deliberately last, so it only ever describes a repo
    // whose files are already indexed.
    //
    // This step is allowed to be worthless. `generateRepoBriefing` returns null
    // instead of throwing on a missing API key, a zero-file repo, a quota
    // error, a timeout or a malformed response, and a null briefing is a
    // renderable state on the card. So nothing here can fail the ingestion —
    // the project's embeddings are already committed by Finalize, and marking
    // the row `failed` over a missing summary would be a lie.
    const briefing = await step.run("Generate Briefing", async () => {
      if (!finalResult.success) {
        // Indexing failed or came up empty. Describing an unindexed repo would
        // be describing something the user cannot search.
        logger.warn(
          `[Inngest] Skipping briefing for ${projectId}: index did not complete successfully`,
        );
        return { generated: false };
      }

      const result = await generateRepoBriefing(projectId);

      if (!result) {
        logger.warn(`[Inngest] No briefing generated for ${projectId}`);
        return { generated: false };
      }

      await db
        .update(projectTables)
        .set({ briefing: result, updatedAt: new Date() })
        .where(eq(projectTables.id, projectId));

      logger.info(
        `[Inngest] ✅ Briefing generated for ${projectId}: ${result.techStack.length} tech entries, ${result.keyComponents.length} components`,
      );

      return { generated: true };
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
      briefingGenerated: briefing.generated,
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

// ---------------------------------------------------------------------------
// 5. Re-sync Project — incremental file refresh + delta re-embedding (F-14)
// ---------------------------------------------------------------------------

/**
 * Re-streams the tarball and reconciles files by content hash.
 *
 * Deliberately does NOT fire `embeddings/generate`. That function loads the
 * MAX_EMBEDDING_FILES *shortest* files, so a changed 200KB file would fall
 * outside the cap and stay permanently un-embedded — the delta has to be the
 * exact set of changed ids, uncapped.
 */
export const resyncProject = inngest.createFunction(
  {
    id: "resync-project",
    // One tarball re-stream per retry against the shared 5,000/hr token pool.
    // Two is enough to ride out a transient 5xx; the cron is what makes a
    // genuinely flaky repo retryable a week later, not a tighter retry budget.
    retries: 2,
    triggers: [{ event: "project/resync" }],
    // No status column to write: a failed re-sync leaves the previous index
    // fully intact and `lastSyncedAt` untouched, so the project is not
    // stranded. The timestamp *is* the status — it only moves on success.
    onFailure: async ({ event, error }) => {
      logger.error(
        `[Inngest] resyncProject exhausted retries for ${event.data.event.data?.projectId}: ${error.message}`,
      );
    },
  },
  async ({ event, step }) => {
    const { projectId } = event.data;

    const [project] = await db
      .select({ githubUrl: projectTables.githubUrl })
      .from(projectTables)
      .where(eq(projectTables.id, projectId))
      .limit(1);

    if (!project) {
      logger.warn(`[Inngest] resyncProject skipped: project ${projectId} is gone`);
      return { success: false, projectId, reason: "not-found" };
    }

    const { owner, repo } = parseGitHubUrl(project.githubUrl);

    const diff = await step.run("Diff Files", async () => {
      logger.info(`[Inngest] Re-syncing ${owner}/${repo} for ${projectId}`);
      return resyncRepositoryFiles(owner, repo, projectId);
    });

    // Nothing moved. Bail before spending an embedding call, and still stamp
    // lastSyncedAt — an up-to-date project that is not stamped would be
    // re-polled by the staleness cron every single night forever.
    if (diff.changedFileIds.length === 0 && diff.removed === 0) {
      await step.run("Finalize", async () => {
        await db
          .update(projectTables)
          .set({ lastSyncedAt: new Date() })
          .where(eq(projectTables.id, projectId));
      });
      return {
        success: true,
        projectId,
        changed: 0,
        removed: 0,
        unchanged: diff.unchanged,
        truncated: diff.truncated,
      };
    }

    // A full embedding run in flight owns the project's files. Re-embedding
    // concurrently would double-write every changed file's embeddings, and the
    // delta ids were computed against a snapshot the full run is about to
    // replace. lastSyncedAt is left alone so tomorrow's cron retries it.
    if (diff.changedFileIds.length > 0) {
      const [state] = await db
        .select({ embeddingStatus: projectTables.embeddingStatus })
        .from(projectTables)
        .where(eq(projectTables.id, projectId))
        .limit(1);

      if (state && isIndexingInFlight(state.embeddingStatus)) {
        logger.warn(
          `[Inngest] resyncProject deferred for ${projectId}: embeddings already processing`,
        );
        return { success: false, projectId, reason: "embeddings-processing" };
      }
    }

    // Uncapped by design — these are exactly the files that changed, so there
    // is nothing to select. Batched so one bad file cannot lose the whole run.
    let embedded = 0;
    const errors: string[] = [];
    const limit = pLimit(EMBEDDING_BATCH_CONCURRENCY);

    await Promise.all(
      chunk(diff.changedFileIds, EMBEDDING_BATCH_SIZE).map((batch, batchIndex) =>
        limit(async () => {
          const batchResult = await step.run(
            `Re-embed Batch ${batchIndex + 1}`,
            async () => {
              const rows = await db
                .select({
                  id: projectFiles.id,
                  fileName: projectFiles.fileName,
                  code: projectFiles.code,
                })
                .from(projectFiles)
                .where(
                  and(
                    eq(projectFiles.projectId, projectId),
                    inArray(projectFiles.id, batch),
                  ),
                );

              const results = await Promise.all(
                rows.map((file) =>
                  processFileForRag(file.id, file.fileName, file.code, projectId),
                ),
              );

              return {
                embedded: results.filter((r) => !r.skipped && !r.error).length,
                errors: results
                  .filter((r) => r.error)
                  .map((r) => `${r.filePath}: ${r.error}`),
              };
            },
          );

          embedded += batchResult.embedded;
          errors.push(...batchResult.errors);
        }),
      ),
    );

    await step.run("Finalize", async () => {
      await db
        .update(projectTables)
        .set({
          lastSyncedAt: new Date(),
          // The tarball pass is authoritative for how many files the repo has,
          // same as the initial import writes it.
          totalFiles: diff.totalSeen,
          updatedAt: new Date(),
        })
        .where(eq(projectTables.id, projectId));
    });

    if (errors.length > 0) {
      // Stamped anyway: the file reconciliation succeeded and the files are
      // indexed as far as they were before. Re-polling the whole tarball
      // nightly over a handful of files the embedding provider choked on
      // would be a poor trade against the shared GitHub pool.
      logger.error(
        `[Inngest] Re-sync completed for ${projectId} with ${errors.length} file error(s): ${errors
          .slice(0, 3)
          .join("; ")}`,
      );
    }

    logger.info(
      `[Inngest] ✅ Re-synced ${projectId}: +${diff.added} ~${diff.modified} -${diff.removed} (${embedded} embedded, ${diff.unchanged} unchanged)`,
    );

    return {
      success: true,
      projectId,
      changed: diff.changedFileIds.length,
      added: diff.added,
      modified: diff.modified,
      removed: diff.removed,
      unchanged: diff.unchanged,
      embedded,
      errors: errors.length,
      truncated: diff.truncated,
    };
  },
);

// ---------------------------------------------------------------------------
// 6. Stale Project Re-sync — nightly sweep for stale projects (F-14)
// ---------------------------------------------------------------------------

/**
 * Nightly sweep that re-syncs projects nobody has looked at in a while.
 *
 * The 5,000/hr GitHub ceiling is one pool for the whole application because
 * every request spends the same GITHUB_TOKEN — there is no per-project budget
 * to draw from. So this sweep is bounded three ways, and all three matter:
 *
 *   1. Only projects with real recent activity. `updatedAt` moves when a user
 *      embeds, syncs issues, or otherwise touches the project, so an abandoned
 *      demo never occupies the pool. Note the failure direction: a project
 *      whose only recent activity was reading the dashboard is NOT bumped, so
 *      it gets polled less often than a human would expect. Under-polling is
 *      the safe direction for a shared budget.
 *   2. Only projects not already synced in STALE_RESYNC_AFTER_DAYS, so a
 *      healthy project costs nothing on most nights.
 *   3. A hard batch cap, so one busy night cannot fan out into hundreds of
 *      tarball streams. Whatever misses the cap is picked up the next night,
 *      because lastSyncedAt was not stamped.
 */
const STALE_RESYNC_AFTER_DAYS = 30;
const STALE_RESYNC_BATCH = 20;

export const staleProjectResync = inngest.createFunction(
  {
    id: "stale-project-resync",
    triggers: [{ cron: "0 4 * * *" }],
    // Same as the other crons: no row to write, so a silent failure would be
    // indistinguishable from a healthy sweep that found nothing to do.
    onFailure: async ({ error }) => {
      logger.error(`[Inngest] staleProjectResync failed: ${error.message}`);
    },
  },
  async ({ step }) => {
    const candidates = await step.run("Find Stale Projects", async () => {
      const cutoff = new Date(
        Date.now() - STALE_RESYNC_AFTER_DAYS * 24 * 60 * 60 * 1000,
      );

      const rows = await db
        .select({ id: projectTables.id })
        .from(projectTables)
        .where(
          and(
            // Stale: never synced, or last synced before the cutoff.
            or(
              isNull(projectTables.lastSyncedAt),
              lt(projectTables.lastSyncedAt, cutoff),
            ),
            // Active: touched within the same window. This is the half that
            // protects the shared token — a project nobody has opened in months
            // is not worth an API call.
            gt(projectTables.updatedAt, cutoff),
          ),
        )
        .limit(STALE_RESYNC_BATCH);

      return rows.map((row) => row.id);
    });

    if (candidates.length === 0) {
      logger.info("[Inngest] Stale re-sync sweep: nothing to do");
      return { success: true, triggered: 0 };
    }

    let triggered = 0;
    for (const projectId of candidates) {
      await step.sendEvent(`resync ${projectId}`, {
        name: "project/resync",
        data: { projectId },
      });
      triggered++;
    }

    logger.info(
      `[Inngest] Stale re-sync sweep triggered ${triggered} project(s)${
        candidates.length >= STALE_RESYNC_BATCH
          ? " (batch cap reached; remainder next run)"
          : ""
      }`,
    );

    return { success: true, triggered };
  },
);
