/**
 * The indexing status vocabulary.
 *
 * Five states, one list, one place. `embeddingStatus` on the `projects` row is
 * the single column every reader and writer of indexing state agrees on, and
 * until this module the legal values were declared in three unrelated shapes: a
 * comment on `db/schema.ts`, `TERMINAL_EMBEDDING_STATUSES` in
 * `embedding-progress.ts`, and the literal at each of the 13 write sites. Any
 * reader had to read all of them to know what a row could say.
 *
 * Pure by design: no database, no Inngest, no server-only imports. Client
 * components read `isTerminalIndexingStatus`, so the vocabulary they need has to
 * be importable from the browser. The writes live beside it in
 * `indexing-state.ts`, which is server-only.
 *
 * The database enforces the same list with a CHECK constraint — migration
 * `0015_indexing_status_check.sql`. That is the authority. This module is the
 * authority for TypeScript, so a typo is a compile error rather than a runtime
 * constraint violation discovered by a user.
 */

/**
 * Every legal `embedding_status` value, in pipeline order.
 *
 * - `pending` — created, or reset for a retry. Nothing is running.
 * - `processing` — a run holds the claim. Exactly one at a time, enforced by the
 *   `ne(status, 'processing')` guard on the claim itself.
 * - `completed` — every file in the repo is searchable. The promise is coverage
 *   of the whole repo, so it is only written when nothing was left out.
 * - `partial` — a working index over a capped subset. Not a failure: the indexed
 *   files answer questions. Written when the repo exceeds the file cap.
 * - `failed` — the run ended without a usable index.
 */
export const INDEXING_STATUSES = [
  "pending",
  "processing",
  "completed",
  "partial",
  "failed",
] as const;

export type IndexingStatus = (typeof INDEXING_STATUSES)[number];

/**
 * The state a newly inserted project row starts in: un-claimed, nothing running.
 *
 * Named because "pending" appears in the INSERT as well as in the reset paths,
 * and those are three different decisions that happen to agree on a value.
 */
export const INITIAL_INDEXING_STATUS: IndexingStatus = "pending";

/**
 * The states a run cannot leave on its own. The pipeline has finished; only a
 * new claim or an explicit reset moves the row on.
 */
export const TERMINAL_INDEXING_STATUSES = ["completed", "partial", "failed"] as const;

export type TerminalIndexingStatus = (typeof TERMINAL_INDEXING_STATUSES)[number];

/** A status is terminal when no step of the pipeline is still going to write it. */
export function isTerminalIndexingStatus(status: string): status is TerminalIndexingStatus {
  return (TERMINAL_INDEXING_STATUSES as readonly string[]).includes(status);
}

/**
 * True while a run holds the claim. Every write a run makes past its claim is
 * guarded on this, so a row that is not `processing` rejects them — that guard
 * is what stops a cancelled-but-still-running pipeline from overwriting the
 * state of the retry that replaced it.
 */
export function isIndexingInFlight(status: string): boolean {
  return status === "processing";
}

/**
 * True when the index can answer a question. `partial` counts: a capped index is
 * a working index over the files it did embed, and refusing to answer on it
 * would strand every repo over the cap with no chat at all.
 */
export function isSearchableIndexingStatus(status: string): boolean {
  return status === "completed" || status === "partial";
}