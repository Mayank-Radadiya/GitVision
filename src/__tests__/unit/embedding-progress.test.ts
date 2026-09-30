import { describe, it, expect } from "vitest";
import {
  derivePhase,
  isTerminalStatus,
  sseFrame,
  toProgressEvent,
  TERMINAL_EMBEDDING_STATUSES,
} from "@/src/lib/embedding-progress";

const counts = (over: Partial<Parameters<typeof derivePhase>[0]> = {}) => ({
  status: "processing",
  indexedFileCount: 0,
  totalFileCount: 0,
  percentage: 0,
  ...over,
});

describe("isTerminalStatus", () => {
  it.each(TERMINAL_EMBEDDING_STATUSES)("treats %s as terminal", (status) => {
    expect(isTerminalStatus(status)).toBe(true);
  });

  it.each(["pending", "processing", "", "COMPLETED"])(
    "treats %s as non-terminal",
    (status) => {
      expect(isTerminalStatus(status)).toBe(false);
    },
  );
});

describe("derivePhase", () => {
  it("returns the terminal status itself once the run has ended", () => {
    expect(derivePhase(counts({ status: "partial" }))).toBe("partial");
    expect(derivePhase(counts({ status: "failed" }))).toBe("failed");
    expect(derivePhase(counts({ status: "completed" }))).toBe("completed");
  });

  it("reports queued for a run that has not started", () => {
    expect(derivePhase(counts({ status: "pending" }))).toBe("queued");
  });

  it("reports preparing before the file set is known", () => {
    expect(derivePhase(counts({ status: "processing" }))).toBe("preparing");
  });

  it("reports embedding once files are being worked through", () => {
    expect(
      derivePhase(counts({ indexedFileCount: 5, totalFileCount: 500 })),
    ).toBe("embedding");
  });

  it("reports finalizing once every file has been attempted", () => {
    expect(
      derivePhase(
        counts({ indexedFileCount: 500, totalFileCount: 500, percentage: 100 }),
      ),
    ).toBe("finalizing");
  });

  it("stays in embedding when the count is complete but the bar is not", () => {
    // The batch loop writes the count and the percentage in the same UPDATE, so
    // this combination is only reachable mid-write — treat it as not-done rather
    // than flashing "finalizing" prematurely.
    expect(
      derivePhase(
        counts({ indexedFileCount: 500, totalFileCount: 500, percentage: 99 }),
      ),
    ).toBe("embedding");
  });
});

describe("toProgressEvent", () => {
  it("adds the derived phase and carries the error through", () => {
    const event = toProgressEvent(
      counts({ indexedFileCount: 3, totalFileCount: 1200, percentage: 1 }),
      "Indexed 3 embeddings but 2 file(s) failed.",
    );

    expect(event).toEqual({
      status: "processing",
      indexedFileCount: 3,
      totalFileCount: 1200,
      percentage: 1,
      phase: "embedding",
      error: "Indexed 3 embeddings but 2 file(s) failed.",
    });
  });

  it("reports a null error when the run is healthy", () => {
    expect(toProgressEvent(counts(), null).error).toBeNull();
  });
});

describe("sseFrame", () => {
  it("emits a single data frame terminated by a blank line", () => {
    const frame = sseFrame({ phase: "embedding" });

    expect(frame.startsWith("data: ")).toBe(true);
    expect(frame.endsWith("\n\n")).toBe(true);
  });

  it("strips newlines so a multi-line message cannot split one frame in two", () => {
    const frame = sseFrame({ error: "line one\nline two" });

    // One "data:" prefix, one trailing terminator — no embedded frame break.
    expect(frame.match(/^data: /g)).toHaveLength(1);
    expect(frame).toBe(
      `data: ${JSON.stringify({ error: "line one\nline two" })}\n\n`,
    );
  });

  it("round-trips through JSON.parse", () => {
    const payload = { phase: "partial", indexedFileCount: 500 };

    expect(JSON.parse(sseFrame(payload).slice(6, -2))).toEqual(payload);
  });
});
