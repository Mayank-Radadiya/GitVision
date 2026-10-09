import { describe, expect, it } from "vitest";
import {
  describeFileIndex,
  fileIndexState,
} from "@/src/lib/file-index-state";

describe("describeFileIndex", () => {
  it("marks a file with chunks as searchable in every project status", () => {
    for (const status of [
      "pending",
      "processing",
      "completed",
      "partial",
      "failed",
    ]) {
      expect(
        describeFileIndex({ chunkCount: 47, tokenCount: 6102, status }),
      ).toStrictEqual({
        state: "indexed",
        label: "Searchable",
        detail: "Indexed · 47 chunks · 6,102 tokens",
        askDisabledReason: null,
      });
    }
  });

  it("uses singular nouns for one chunk and one token", () => {
    expect(
      describeFileIndex({ chunkCount: 1, tokenCount: 1, status: "partial" })
        .detail,
    ).toBe("Indexed · 1 chunk · 1 token");
  });

  it("marks an unchunked file as skipped only when the run completed", () => {
    expect(
      describeFileIndex({ chunkCount: 0, tokenCount: 0, status: "completed" }),
    ).toStrictEqual({
      state: "skipped",
      label: "Skipped",
      detail: "Skipped — this run produced no indexable chunks",
      askDisabledReason:
        "Ask is unavailable: this file produced no indexable chunks.",
    });
  });

  it("distinguishes a capped run from one that has not reached the file", () => {
    expect(
      describeFileIndex({ chunkCount: 0, status: "partial" }).detail,
    ).toContain("capped indexing run did not reach this file");
    expect(
      describeFileIndex({ chunkCount: 0, status: "processing" }).detail,
    ).toContain("has not reached this file yet");
  });

  it("degrades failed, pending, and unknown statuses to not-indexed", () => {
    for (const status of ["pending", "failed", "archived"]) {
      const description = describeFileIndex({ chunkCount: 0, status });
      expect(description.state).toBe("not-indexed");
      expect(description.label).toBe("Not indexed");
      expect(description.askDisabledReason).toContain("Ask is unavailable");
    }
  });

  it("treats invalid counts as zero instead of searchable", () => {
    expect(
      fileIndexState({
        chunkCount: Number.NaN,
        tokenCount: -12,
        status: "completed",
      }),
    ).toBe("skipped");
  });
});
