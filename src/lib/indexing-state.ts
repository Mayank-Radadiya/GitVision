/**
 * Indexing state transitions.
 *
 * One interface for every write to `projects.embedding_status` and the counters
 * that travel with it. Before this module the column was written from 13 sites
 * across 4 files, each restating the same three facts by hand: which values are
 * legal, which columns belong with a given status, and — the one that mattered
 * and was stated nowhere — that a run may only write while it holds the claim.
 *
 * ## The claim
 *
 * `claimIndexing` is the only way to enter `processing`. It is a single
 * conditional UPDATE, so two concurrent runs cannot both win. From the moment it
 * returns true, the caller owns the row until it settles.
 *
 * Every subsequent write a run makes goes through the `*Indexing` functions
 * below, and each of those is guarded on still holding the claim. That guard is
 * what makes cancellation safe: `resetIndexing` (the DELETE handler) puts the row
 * back to `pending` while the Inngest function may still be mid-step, and the
 * `embeddings/cancel` event is best-effort — if the send fails, the run keeps
 * going. With the guard, a run that has lost the claim cannot overwrite the
 * retry that replaced it. Without it, `processing → pending → processing` lets a
 * second run claim a project the first one is still embedding.
 *
 * ## The one unguarded write
 *
 * `failAbandonedIndexing` is guarded on *not* holding the claim instead, because
 * it is the recovery path for a run that never claimed — a claim step that threw,
 * or retries exhausted before Prepare. It is written from `onFailure`, where the
 * project would otherwise be stranded at `pending` forever. Its guard keeps it
 * from clobbering a different run that did claim successfully.
 *
 * ## Layers
 *
 * This module imports `db`, so it is server-only. The status vocabulary is in
 * `indexing-status.ts` beside it, which imports nothing — client components need
 * to read the same five values.
 */

import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { codeEmbeddings, projectTables } from "@/db/schema";
import type { TerminalIndexingStatus } from "@/src/lib/indexing-status";

/** Counters a settled index publishes alongside its terminal status. */
export interface IndexingOutcome {
  /** Files the run actually embedded. Excludes files that errored. */
  indexedFileCount: number;
  /** Total tokens stored, used by the full-dump fast path to decide repo size. */
  estimatedTokens: number;
}

function now(): Date {
  return new Date();
}

/**
 * Take the claim, or report that someone else holds it.
 *
 * Returns `true` if this call won the row and the caller now owns indexing for
 * it; `false` if a run is already in flight. The counters are zeroed as part of
 * the claim so a re-run never shows the previous run's counts while it is still
 * discovering its files.
 */
export async function claimIndexing(projectId: string): Promise<boolean> {
  const [claimed] = await db
    .update(projectTables)
    .set({
      embeddingStatus: "processing",
      embeddingProgress: 0,
      embeddingError: null,
      indexedFileCount: 0,
      totalFileCount: 0,
      lastEmbeddingAttempt: now(),
      updatedAt: now(),
    })
    .where(and(eq(projectTables.id, projectId), ne(projectTables.embeddingStatus, "processing")))
    .returning({ id: projectTables.id });

  return claimed !== undefined;
}

/**
 * Publish the denominator, so the SSE stream can render "N of M" while batches
 * are still running.
 *
 * Guarded on the claim: a cancelled run must not overwrite the scope its
 * replacement already published.
 */
export async function publishIndexingScope(projectId: string, totalFileCount: number): Promise<void> {
  await db
    .update(projectTables)
    .set({ totalFileCount, updatedAt: now() })
    .where(and(eq(projectTables.id, projectId), eq(projectTables.embeddingStatus, "processing")));
}

/**
 * Publish a running estimate of progress after a batch.
 *
 * Guarded on the claim. Callers must compute the percentage monotonically — this
 * does not enforce ordering, only that the writer still owns the row.
 */
export async function publishIndexingProgress(
  projectId: string,
  progress: { percent: number; indexedFileCount: number },
): Promise<void> {
  await db
    .update(projectTables)
    .set({
      embeddingProgress: progress.percent,
      indexedFileCount: progress.indexedFileCount,
      updatedAt: now(),
    })
    .where(and(eq(projectTables.id, projectId), eq(projectTables.embeddingStatus, "processing")));
}

/**
 * Settle the claim as `completed` — the whole repo is searchable.
 *
 * Only call this when nothing was left out. The promise is coverage of every
 * file, so a run that skipped any file uses `partiallyCompleteIndexing`.
 */
export async function completeIndexing(projectId: string, outcome: IndexingOutcome): Promise<void> {
  await settleIndexing(projectId, "completed", outcome, null);
}

/**
 * Settle the claim as `partial` — a working index over a capped subset.
 *
 * Not a failure: the embedded files answer questions. The caller must pass the
 * reason, because the UI shows it to explain which half of the repo is missing.
 */
export async function partiallyCompleteIndexing(
  projectId: string,
  outcome: IndexingOutcome,
  reason: string,
): Promise<void> {
  await settleIndexing(projectId, "partial", outcome, reason);
}

/**
 * Settle the claim as `failed` from a run that held it.
 *
 * `progress` is opt-in: a run that never indexed a file must not render as 100%,
 * while a run that worked through every batch and then found errors has, in fact,
 * finished what it set out to do. Leaving it unset leaves the running estimate
 * alone rather than guessing.
 */
export async function failIndexing(
  projectId: string,
  error: string,
  options?: {
    progress?: number;
    indexedFileCount?: number;
    estimatedTokens?: number;
  },
): Promise<void> {
  await db
    .update(projectTables)
    .set({
      embeddingStatus: "failed",
      embeddingError: error,
      embeddingProgress: options?.progress,
      indexedFileCount: options?.indexedFileCount,
      estimatedTokens: options?.estimatedTokens,
      updatedAt: now(),
    })
    .where(and(eq(projectTables.id, projectId), eq(projectTables.embeddingStatus, "processing")));
}

/**
 * Mark a run `failed` when it never held the claim.
 *
 * The recovery path for a run that died before or during its claim: an exhausted
 * retry, a claim step that threw, or a pipeline that was cancelled outright.
 * Guarded on *not* being in `processing` so it cannot mark a healthy concurrent
 * run as failed.
 *
 * This is the one write that can move a row out of `pending` without a claim, so
 * it is also the one place the pipeline can strand a project at `failed` for
 * reasons the user never caused.
 */
export async function failAbandonedIndexing(projectId: string, error: string): Promise<void> {
  await db
    .update(projectTables)
    .set({
      embeddingStatus: "failed",
      embeddingError: error,
      lastEmbeddingAttempt: now(),
      updatedAt: now(),
    })
    .where(and(eq(projectTables.id, projectId), ne(projectTables.embeddingStatus, "processing")));
}

/**
 * Put the row back to `pending` so it can be claimed again.
 *
 * Unguarded on purpose: this is the operator intent — a cancel, or a retry after
 * a failure. Any run still holding the claim is by definition stale, and the
 * guards on the `*Indexing` writers mean it can no longer write over this.
 */
export async function resetIndexing(projectId: string): Promise<void> {
  await db
    .update(projectTables)
    .set({
      embeddingStatus: "pending",
      embeddingProgress: 0,
      embeddingError: null,
      updatedAt: now(),
    })
    .where(eq(projectTables.id, projectId));
}

/**
 * Reset a project whose row says `completed` but which has no embeddings at all.
 *
 * Both `POST` (before queueing a retry) and `GET` (so a poll reports the truth)
 * need this, and the reset script needs it too. Returns whether a repair
 * happened, so the caller can report `pending` rather than echoing the stale row.
 */
export async function repairEmptyIndex(projectId: string): Promise<boolean> {
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(codeEmbeddings)
    .where(eq(codeEmbeddings.projectId, projectId));

  if ((countResult?.count ?? 0) !== 0) return false;

  await resetIndexing(projectId);
  return true;
}

/**
 * Projects holding a claim that no live run is advancing — the signature of a
 * pipeline that died without settling. A null `updatedAt` counts as stale: the
 * row was written before the column existed.
 *
 * Read by the health check, which bounds the result because the response is
 * public and untrusted-project names are not.
 */
export async function findAbandonedClaims(
  staleBefore: Date,
  limit: number,
): Promise<Array<{ id: string; embeddingStatus: string; updatedAt: Date | null }>> {
  return db
    .select({
      id: projectTables.id,
      embeddingStatus: projectTables.embeddingStatus,
      updatedAt: projectTables.updatedAt,
    })
    .from(projectTables)
    .where(
      and(
        eq(projectTables.embeddingStatus, "processing"),
        or(lt(projectTables.updatedAt, staleBefore), isNull(projectTables.updatedAt)),
      ),
    )
    .limit(limit);
}

/** Reset every abandoned claim back to `pending` in one statement. */
export async function resetAbandonedClaims(staleBefore: Date): Promise<Array<{ id: string; projectName: string }>> {
  return db
    .update(projectTables)
    .set({
      embeddingStatus: "pending",
      embeddingProgress: 0,
      embeddingError: null,
      updatedAt: now(),
    })
    .where(
      and(
        eq(projectTables.embeddingStatus, "processing"),
        or(lt(projectTables.updatedAt, staleBefore), isNull(projectTables.updatedAt)),
      ),
    )
    .returning({ id: projectTables.id, projectName: projectTables.projectName });
}

/** Shared tail of every terminal settle. */
async function settleIndexing(
  projectId: string,
  status: TerminalIndexingStatus,
  outcome: IndexingOutcome,
  error: string | null,
): Promise<void> {
  await db
    .update(projectTables)
    .set({
      embeddingStatus: status,
      embeddingProgress: 100,
      embeddingError: error,
      indexedFileCount: outcome.indexedFileCount,
      estimatedTokens: outcome.estimatedTokens,
      updatedAt: now(),
    })
    .where(and(eq(projectTables.id, projectId), eq(projectTables.embeddingStatus, "processing")));
}