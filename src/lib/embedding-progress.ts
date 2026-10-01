/**
 * Indexing progress shaping for the SSE stream.
 *
 * The counters live on the `projects` row; the *phase* is derived from them
 * rather than stored, so it cannot drift out of sync with the counts it is
 * derived from. Nothing in here touches the database — the route does the
 * reading, this decides what a row means.
 */

// Sourced from the vocabulary module rather than declared here. This file
// decides what a row means for the SSE stream; it does not decide which values
// are legal. `indexing-status.ts` is the single declaration, and the database
// constrains the same list (migration 0015).
//
// Re-exported under the old names so the three call sites that predate
// `indexing-status.ts` do not each have to know which of the two modules owns
// the vocabulary.
import {
  TERMINAL_INDEXING_STATUSES,
  isTerminalIndexingStatus,
  type TerminalIndexingStatus,
} from "@/src/lib/indexing-status";

export {
  TERMINAL_INDEXING_STATUSES as TERMINAL_EMBEDDING_STATUSES,
  isTerminalIndexingStatus as isTerminalStatus,
};
export type { TerminalIndexingStatus };

export type IndexingPhase =
  | "queued"
  | "preparing"
  | "embedding"
  | "finalizing"
  | TerminalIndexingStatus;

export interface IndexingCounts {
  status: string;
  indexedFileCount: number;
  totalFileCount: number;
  percentage: number;
}

/**
 * `totalFileCount` is written by the Prepare step, so a run that has claimed
 * the project but not yet counted its files is legitimately 0. That is the
 * only way to tell "still working out the scope" from "working through it".
 */
export function derivePhase({ status, indexedFileCount, totalFileCount, percentage }: IndexingCounts): IndexingPhase {
  if (isTerminalIndexingStatus(status)) return status;
  if (status !== "processing") return "queued";
  if (totalFileCount <= 0) return "preparing";
  if (indexedFileCount < totalFileCount) return "embedding";
  // Every file the run intends to embed is done; the percentage has not been
  // clamped to 100 yet, so Finalize has not landed.
  return percentage >= 100 ? "finalizing" : "embedding";
}

export interface IndexingProgressEvent extends IndexingCounts {
  phase: IndexingPhase;
  error: string | null;
}

export function toProgressEvent(row: IndexingCounts, error: string | null): IndexingProgressEvent {
  return { ...row, phase: derivePhase(row), error };
}

/** SSE frames are newline-delimited; a bare `\n` inside a payload would split one frame into two. */
export function sseFrame(data: unknown): string {
  return `data: ${JSON.stringify(data).replace(/\n/g, "")}\n\n`;
}
