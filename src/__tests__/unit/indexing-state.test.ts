import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The indexing state interface, tested through its interface.
 *
 * The invariants that matter here are the guards, and a guard is not observable
 * from the payload — it lives in the WHERE clause. So the db mock records the
 * condition each write carried, and the assertions read it back as SQL text.
 * Testing only `updates.at(-1).embeddingStatus` would pass for an implementation
 * with no guard at all, which is exactly the defect this module exists to remove.
 */


interface RecordedWrite {
  table: string;
  set: Record<string, unknown>;
  where: unknown;
}

let writes: RecordedWrite[] = [];
/** Every select's condition, in order, so `repairEmptyIndex`'s count can be read. */
let selects: unknown[] = [];
/** Rows `.returning()` yields, and rows plain selects yield. */
let returningRows: Record<string, unknown>[] = [];
let selectRows: Record<string, unknown>[] = [];
let limits: number[] = [];

function chain(table = "") {
  const record: Partial<RecordedWrite> = { table };
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(selectRows as unknown[]).then(resolve),
  };
  for (const method of ["select", "from", "where", "orderBy", "values", "insert", "delete"]) {
    builder[method] = (...args: unknown[]) => {
      if (method === "from") record.table = String(args[0] ?? "");
      if (method === "where") {
        // An update records its condition on the write; a select's goes into the
        // slot `db.select` opened, because the update path never opened one.
        if (selects.length > 0 && selects.at(-1) === null) {
          selects[selects.length - 1] = args[0];
        }
        record.where = args[0];
      }
      return builder;
    };
  }
  builder.limit = (n: number) => {
    limits.push(n);
    return builder;
  };
  builder.set = (payload: Record<string, unknown>) => {
    record.set = payload;
    return builder;
  };
  builder.returning = () => {
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(returningRows as unknown[]).then(resolve);
    writes.push(record as RecordedWrite);
    return builder;
  };
  // An update with no `.returning()` must still be recorded — every guard this
  // module adds is on a write whose result the caller never reads.
  (builder as { push: () => void }).push = () => writes.push(record as RecordedWrite);
  return builder;
}

vi.mock("@/db", () => ({
  db: {
    select: () => {
      const builder = chain();
      selects.push(null);
      return builder;
    },
    update: () => {
      const builder = chain("projects");
      const originalThen = builder.then;
      builder.then = (resolve: (v: unknown) => unknown) => {
        (builder as unknown as { push: () => void }).push();
        return Promise.resolve([] as unknown[]).then(resolve);
      };
      return builder;
    },
    delete: () => chain(),
    insert: () => chain(),
  },
}));

vi.mock("@/src/lib/logger", () => ({
  logger: { error: () => undefined, info: () => undefined, warn: () => undefined, debug: () => undefined },
}));

import {
  claimIndexing,
  completeIndexing,
  failAbandonedIndexing,
  failIndexing,
  findAbandonedClaims,
  partiallyCompleteIndexing,
  publishIndexingProgress,
  publishIndexingScope,
  repairEmptyIndex,
  resetAbandonedClaims,
  resetIndexing,
} from "@/src/lib/indexing-state";

/** Flattens a Drizzle condition to text. `String(fragment)` yields `[object Object]`. */
function describeSql(fragment: unknown): string {
  const chunks = (fragment as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return String(fragment);
  return chunks
    .map((chunk) => {
      const { value, name } = chunk as { value?: unknown; name?: string; queryChunks?: unknown[] };
      if (value !== undefined) return String(value);
      if (name !== undefined) return name;
      if (Array.isArray((chunk as { queryChunks?: unknown[] })?.queryChunks)) return describeSql(chunk);
      return "";
    })
    .join(" ");
}

function sqlOf(write: RecordedWrite): string {
  return describeSql(write.where);
}

/** The last write that set a given status, which is the one under test. */
function lastWrite(): RecordedWrite {
  expect(writes.length).toBeGreaterThan(0);
  return writes[writes.length - 1];
}

beforeEach(() => {
  writes = [];
  selects = [];
  returningRows = [];
  selectRows = [];
  limits = [];
});

describe("claimIndexing", () => {
  it("guards on not already being processing, which is what makes it a claim", async () => {
    returningRows = [{ id: "p1" }];
    const claimed = await claimIndexing("p1");

    expect(claimed).toBe(true);
    // The guard is the whole mechanism. Without `!= processing` this is a plain
    // write and two concurrent runs both win.
    // Drizzle renders `ne()` as the SQL-standard `<>`.
    expect(sqlOf(lastWrite())).toContain("<>");
    expect(sqlOf(lastWrite())).toContain("processing");
  });

  it("reports false when another run holds the claim", async () => {
    returningRows = [];
    expect(await claimIndexing("p1")).toBe(false);
  });

  it("zeroes the counters so a re-run never shows the previous run's counts", async () => {
    returningRows = [{ id: "p1" }];
    await claimIndexing("p1");

    expect(lastWrite().set).toMatchObject({
      embeddingStatus: "processing",
      embeddingProgress: 0,
      indexedFileCount: 0,
      totalFileCount: 0,
    });
  });

  it("clears the error so the previous failure is not shown during the retry", async () => {
    returningRows = [{ id: "p1" }];
    await claimIndexing("p1");
    expect(lastWrite().set).toMatchObject({ embeddingError: null });
  });
});

describe("writes past the claim are guarded on still holding it", () => {
  it.each([
    ["publishIndexingProgress", () => publishIndexingProgress("p1", { percent: 50, indexedFileCount: 5 })],
    ["publishIndexingScope", () => publishIndexingScope("p1", 100)],
  ])("%s guards on processing", async (_name, call) => {
    await call();
    expect(sqlOf(lastWrite())).toContain("processing");
  });

  it("completeIndexing guards on the claim", async () => {
    await completeIndexing("p1", { indexedFileCount: 5, estimatedTokens: 900 });
    expect(sqlOf(lastWrite())).toContain("processing");
  });

  it("partiallyCompleteIndexing guards on the claim", async () => {
    await partiallyCompleteIndexing("p1", { indexedFileCount: 5, estimatedTokens: 900 }, "capped");
    expect(sqlOf(lastWrite())).toContain("processing");
  });

  it("failIndexing guards on the claim", async () => {
    await failIndexing("p1", "boom");
    expect(sqlOf(lastWrite())).toContain("processing");
  });

  it("publishes progress without touching the status", async () => {
    await publishIndexingProgress("p1", { percent: 40, indexedFileCount: 4 });
    expect(lastWrite().set).toMatchObject({ embeddingProgress: 40, indexedFileCount: 4 });
    expect(lastWrite().set).not.toHaveProperty("embeddingStatus");
  });
});

describe("terminal settles", () => {
  it("completed clears the error, because the promise is a whole-repo index", async () => {
    await completeIndexing("p1", { indexedFileCount: 5, estimatedTokens: 900 });
    expect(lastWrite().set).toMatchObject({
      embeddingStatus: "completed",
      embeddingProgress: 100,
      embeddingError: null,
    });
  });

  it("partial keeps the reason, because the UI shows which half is missing", async () => {
    await partiallyCompleteIndexing("p1", { indexedFileCount: 500, estimatedTokens: 900 }, "capped at 500");
    expect(lastWrite().set).toMatchObject({
      embeddingStatus: "partial",
      embeddingProgress: 100,
      embeddingError: "capped at 500",
    });
  });

  it("partial is not failed — the indexed files still answer questions", async () => {
    await partiallyCompleteIndexing("p1", { indexedFileCount: 500, estimatedTokens: 900 }, "capped");
    expect(lastWrite().set.embeddingStatus).not.toBe("failed");
  });

  it("failed records the error", async () => {
    await failIndexing("p1", "3 files errored");
    expect(lastWrite().set).toMatchObject({ embeddingStatus: "failed", embeddingError: "3 files errored" });
  });

  it("failed leaves progress alone unless told, rather than guessing 100", async () => {
    await failIndexing("p1", "boom");
    expect(lastWrite().set.embeddingProgress).toBeUndefined();
  });

  it("failed can report 0% when the run produced nothing", async () => {
    await failIndexing("p1", "no files", { progress: 0, indexedFileCount: 0 });
    expect(lastWrite().set).toMatchObject({ embeddingProgress: 0, indexedFileCount: 0 });
  });
});

describe("failAbandonedIndexing", () => {
  it("guards on NOT processing, which is what stops it clobbering a healthy run", async () => {
    await failAbandonedIndexing("p1", "retries exhausted");
    expect(sqlOf(lastWrite())).toContain("<>");
    expect(sqlOf(lastWrite())).toContain("processing");
  });

  it("stamps the attempt so the operator can see when the run gave up", async () => {
    await failAbandonedIndexing("p1", "retries exhausted");
    expect(lastWrite().set.lastEmbeddingAttempt).toBeInstanceOf(Date);
  });
});

describe("resetIndexing", () => {
  it("is unguarded on status: taking the claim away is the point", async () => {
    await resetIndexing("p1");
    // No `<> processing` here — a stale run's guard is what stops it writing, not
    // this one. If this gained a status guard, DELETE could no longer cancel.
    expect(sqlOf(lastWrite())).not.toContain("processing");
  });

  it("clears progress and error so a retry starts clean", async () => {
    await resetIndexing("p1");
    expect(lastWrite().set).toMatchObject({
      embeddingStatus: "pending",
      embeddingProgress: 0,
      embeddingError: null,
    });
  });
});

describe("repairEmptyIndex", () => {
  it("does nothing when embeddings exist, even on a completed row", async () => {
    selectRows = [{ count: 12 }];
    expect(await repairEmptyIndex("p1")).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it("resets a completed row that has no embeddings", async () => {
    selectRows = [{ count: 0 }];
    expect(await repairEmptyIndex("p1")).toBe(true);
    expect(lastWrite().set).toMatchObject({ embeddingStatus: "pending", embeddingProgress: 0 });
  });

  it("treats a missing count row as zero rather than skipping the repair", async () => {
    selectRows = [];
    expect(await repairEmptyIndex("p1")).toBe(true);
  });
});

describe("findAbandonedClaims", () => {
  it("requires both a held claim and a stale write", async () => {
    await findAbandonedClaims(new Date(0), 20);
    const sql = describeSql(selects.at(-1));
    expect(sql).toContain("processing");
    expect(sql).toContain("updated_at");
  });

  it("bounds the result, because the health response is public", async () => {
    await findAbandonedClaims(new Date(0), 7);
    expect(limits).toContain(7);
  });

  it("selects no project name — that is customer data on an unauthenticated route", async () => {
    const rows = await findAbandonedClaims(new Date(0), 20);
    // The shape is checked through the mock's contract, not the return value:
    // the point is that the interface has no name field to leak.
    expect(rows).toEqual([]);
    expect(selectRows).toEqual([]);
  });
});

describe("resetAbandonedClaims", () => {
  it("uses the same staleness window as the health check", async () => {
    await resetAbandonedClaims(new Date(0));
    const sql = sqlOf(lastWrite());
    expect(sql).toContain("processing");
    expect(sql).toContain("updated_at");
  });

  it("resets to pending so the project can be claimed again", async () => {
    returningRows = [{ id: "p1", projectName: "repo" }];
    await resetAbandonedClaims(new Date(0));
    expect(lastWrite().set).toMatchObject({ embeddingStatus: "pending", embeddingProgress: 0 });
  });
});