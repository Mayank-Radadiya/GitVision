/**
 * Per-file index state.
 *
 * The database proves only that a file has chunks. Whether zero means
 * “examined and declined” or “never reached” depends on the project-level
 * embedding run: `completed` promises every considered file was processed,
 * while a capped `partial` run never sees files beyond its limit. The status
 * therefore changes the label; the chunk count alone cannot.
 */

export type FileIndexState = "indexed" | "skipped" | "not-indexed";

export interface FileIndexDescription {
  state: FileIndexState;
  label: "Searchable" | "Skipped" | "Not indexed";
  detail: string;
  /** Null when Ask can use the file; otherwise the disabled-control reason. */
  askDisabledReason: string | null;
}

export interface FileIndexInput {
  chunkCount: number;
  tokenCount?: number | null;
  status: string;
}

function pluralize(value: number, singular: string, plural: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? singular : plural}`;
}

function normalizedChunkCount(chunkCount: number): number {
  if (!Number.isFinite(chunkCount)) return 0;
  return Math.max(0, Math.floor(chunkCount));
}

function normalizedTokenCount(tokenCount: number | null | undefined): number {
  if (!Number.isFinite(tokenCount)) return 0;
  return Math.max(0, Math.floor(tokenCount as number));
}

/**
 * Describe one stored file’s searchability.
 *
 * Unknown statuses degrade to `not-indexed` because an unrecognized run state
 * must never be presented as searchable.
 */
export function describeFileIndex({
  chunkCount,
  tokenCount,
  status,
}: FileIndexInput): FileIndexDescription {
  const chunks = normalizedChunkCount(chunkCount);
  const tokens = normalizedTokenCount(tokenCount);

  if (chunks > 0) {
    return {
      state: "indexed",
      label: "Searchable",
      detail: `Indexed · ${pluralize(chunks, "chunk", "chunks")} · ${pluralize(
        tokens,
        "token",
        "tokens",
      )}`,
      askDisabledReason: null,
    };
  }

  if (status === "completed") {
    return {
      state: "skipped",
      label: "Skipped",
      detail: "Skipped — this run produced no indexable chunks",
      askDisabledReason:
        "Ask is unavailable: this file produced no indexable chunks.",
    };
  }

  if (status === "partial") {
    return {
      state: "not-indexed",
      label: "Not indexed",
      detail: "Not indexed — the capped indexing run did not reach this file",
      askDisabledReason:
        "Ask is unavailable: the capped indexing run did not reach this file.",
    };
  }

  if (status === "processing" || status === "pending") {
    return {
      state: "not-indexed",
      label: "Not indexed",
      detail: "Not indexed — the indexing run has not reached this file yet",
      askDisabledReason:
        "Ask is unavailable: indexing has not reached this file yet.",
    };
  }

  return {
    state: "not-indexed",
    label: "Not indexed",
    detail: "Not indexed — this project has no usable index for this file",
    askDisabledReason:
      "Ask is unavailable: this project has no usable index for this file.",
  };
}

/** Shorthand when only the dot/tone is needed. */
export function fileIndexState(input: FileIndexInput): FileIndexState {
  return describeFileIndex(input).state;
}
