/**
 * The embedding-progress poll must not outlive the query it polls.
 *
 * `refetchInterval` receives the query and previously read only
 * `query.state.data.embeddingStatus`. React Query keeps the last successful
 * `data` in place when a refetch fails and flips `state.status` to `"error"`,
 * so a project deleted mid-index answered 404 forever: `data` still said
 * `"processing"`, the predicate kept returning 5000, and every tick paid the
 * client's retry budget on the way to the same permanent error.
 *
 * The guard under test is `state.status === "success"`. These are pure
 * function tests on purpose — the failure is a predicate reading the wrong field
 * of the query state, and rendering the hook cannot observe the difference.
 */

import { describe, expect, it } from "vitest";
import {
  EMBEDDING_POLL_INTERVAL_MS,
  shouldPollEmbeddingStatus,
} from "@/features/projects/hooks/use-project";

/** The slice of `QueryState` the predicate reads. */
function state(
  status: string,
  embeddingStatus?: string | null,
): { status: string; data?: { embeddingStatus?: string | null } } {
  return {
    status,
    data: embeddingStatus === undefined ? undefined : { embeddingStatus },
  };
}

describe("shouldPollEmbeddingStatus", () => {
  it("polls while a project is waiting for a run", () => {
    expect(shouldPollEmbeddingStatus(state("success", "pending"))).toBe(true);
  });

  it("polls while a run holds the claim", () => {
    expect(shouldPollEmbeddingStatus(state("success", "processing"))).toBe(true);
  });

  it("stops at every terminal indexing status", () => {
    for (const status of ["completed", "partial", "failed"]) {
      expect(shouldPollEmbeddingStatus(state("success", status))).toBe(false);
    }
  });

  it("stops when the project reports no status at all", () => {
    expect(shouldPollEmbeddingStatus(state("success", null))).toBe(false);
    expect(shouldPollEmbeddingStatus(state("success"))).toBe(false);
  });

  it("stops the moment the query is in error, however stale its data is", () => {
    // The regression. React Query holds the last good `data` across an error,
    // so a deleted project still claims `processing` forever.
    expect(shouldPollEmbeddingStatus(state("error", "processing"))).toBe(false);
    expect(shouldPollEmbeddingStatus(state("error", "pending"))).toBe(false);
  });

  it("does not poll before the first result arrives", () => {
    expect(shouldPollEmbeddingStatus(state("pending"))).toBe(false);
  });
});

describe("EMBEDDING_POLL_INTERVAL_MS", () => {
  it("is the five-second window the progress header is drawn around", () => {
    expect(EMBEDDING_POLL_INTERVAL_MS).toBe(5000);
  });
});
