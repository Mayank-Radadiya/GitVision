import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  INDEXING_STATUSES,
  TERMINAL_INDEXING_STATUSES,
  isIndexingInFlight,
  isSearchableIndexingStatus,
  isTerminalIndexingStatus,
  type IndexingStatus,
} from "@/src/lib/indexing-status";

describe("INDEXING_STATUSES", () => {
  it("is exactly the five states the pipeline writes", () => {
    expect([...INDEXING_STATUSES].sort()).toEqual(
      ["completed", "failed", "partial", "pending", "processing"].sort(),
    );
  });

  it("agrees with the database CHECK constraint in migration 0015", () => {
    // The TypeScript list is a convenience; the constraint is the authority.
    // They are declared in two files that cannot import each other, so this test
    // is what keeps them from drifting — a status added here and not there would
    // compile, pass every other suite, and fail at runtime on the first write.
    const migration = readFileSync(
      path.resolve(process.cwd(), "db/migrations/0015_indexing_status_check.sql"),
      "utf8",
    );
    const check = migration.match(/CHECK \("embedding_status" IN \(([^)]*)\)/);
    expect(check).not.toBeNull();

    const constrained = [...check![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(constrained).toEqual([...INDEXING_STATUSES].sort());
  });
});

describe("terminal states", () => {
  it("are the three a run cannot leave on its own", () => {
    expect([...TERMINAL_INDEXING_STATUSES].sort()).toEqual(["completed", "failed", "partial"]);
  });

  it.each(TERMINAL_INDEXING_STATUSES)("treats %s as terminal", (status) => {
    expect(isTerminalIndexingStatus(status)).toBe(true);
  });

  it.each(["pending", "processing"])("does not treat %s as terminal", (status) => {
    expect(isTerminalIndexingStatus(status)).toBe(false);
  });

  it("treats an unknown status as non-terminal rather than guessing", () => {
    // A value the code does not know is not terminal: the run may still be
    // moving, and claiming otherwise would close the SSE stream early.
    expect(isTerminalIndexingStatus("garbage")).toBe(false);
  });

  it("never reports pending or processing as terminal", () => {
    for (const status of INDEXING_STATUSES) {
      if (status === "pending" || status === "processing") {
        expect(isTerminalIndexingStatus(status)).toBe(false);
      }
    }
  });
});

describe("isIndexingInFlight", () => {
  it("is true only while a run holds the claim", () => {
    expect(isIndexingInFlight("processing")).toBe(true);
    expect(isIndexingInFlight("pending")).toBe(false);
    expect(isIndexingInFlight("completed")).toBe(false);
    expect(isIndexingInFlight("failed")).toBe(false);
  });

  it("agrees with the set of terminal states — in-flight and terminal are disjoint", () => {
    for (const status of INDEXING_STATUSES) {
      expect(isIndexingInFlight(status) && isTerminalIndexingStatus(status)).toBe(false);
    }
  });
});

describe("isSearchableIndexingStatus", () => {
  it("counts a partial index as searchable", () => {
    // The cap cuts the file set short; it does not make the index empty.
    // Refusing to answer on a partial index would strand every repo over the
    // cap with no chat at all.
    expect(isSearchableIndexingStatus("partial")).toBe(true);
  });

  it("is true only for the two states that mean a usable index", () => {
    expect(isSearchableIndexingStatus("completed")).toBe(true);
    expect(isSearchableIndexingStatus("pending")).toBe(false);
    expect(isSearchableIndexingStatus("processing")).toBe(false);
    expect(isSearchableIndexingStatus("failed")).toBe(false);
  });

  it("implies terminal, since a non-terminal row is still being written", () => {
    for (const status of INDEXING_STATUSES) {
      if (isSearchableIndexingStatus(status)) {
        expect(isTerminalIndexingStatus(status)).toBe(true);
      }
    }
  });
});

describe("type", () => {
  it("covers every value in the list", () => {
    // Compile-time assertion: if the list grows and the type is not derived from
    // it, this assignment stops typechecking.
    const exhaustive: IndexingStatus[] = [...INDEXING_STATUSES];
    expect(exhaustive).toHaveLength(INDEXING_STATUSES.length);
  });
});