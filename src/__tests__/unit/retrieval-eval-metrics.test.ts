import { describe, it, expect } from "vitest";
import {
  EVAL_DATASET,
  EVAL_REPOS,
  hitAtK,
  macroAverage,
} from "../../../scripts/data/retrieval-eval-dataset";

describe("hitAtK", () => {
  const ranked = ["a.js", "b.js", "c.js", "d.js", "e.js", "f.js", "g.js", "h.js", "i.js", "j.js"];

  it("scores a file inside the window as a hit", () => {
    expect(hitAtK(ranked, "b.js", 3)).toBe(true);
    expect(hitAtK(ranked, "j.js", 10)).toBe(true);
  });

  it("scores a file outside the window as a miss", () => {
    expect(hitAtK(ranked, "d.js", 3)).toBe(false);
    expect(hitAtK(ranked, "b.js", 1)).toBe(false);
  });

  it("is monotonic in k", () => {
    for (let k = 1; k <= ranked.length; k++) {
      expect(hitAtK(ranked, "g.js", k)).toBe(k >= 7);
    }
  });

  it("treats k <= 0 as an empty window", () => {
    expect(hitAtK(ranked, "a.js", 0)).toBe(false);
    expect(hitAtK(ranked, "a.js", -1)).toBe(false);
  });

  it("misses when nothing was retrieved", () => {
    expect(hitAtK([], "a.js", 10)).toBe(false);
  });

  it("does not match on a substring of a different path", () => {
    expect(hitAtK(["lib/request.js"], "request.js", 10)).toBe(false);
    expect(hitAtK(["lib/request.js"], "lib/request.js", 10)).toBe(true);
  });
});

describe("macroAverage", () => {
  it("averages the per-case outcomes", () => {
    expect(macroAverage([1, 0, 1, 1])).toBeCloseTo(0.75);
    expect(macroAverage([1, 1])).toBe(1);
    expect(macroAverage([0, 0])).toBe(0);
  });

  it("scores an empty run as 0 rather than NaN", () => {
    expect(macroAverage([])).toBe(0);
  });
});

describe("EVAL_DATASET", () => {
  it("holds 30 cases split across the three benchmark repos", () => {
    expect(EVAL_DATASET).toHaveLength(30);
    expect([...EVAL_REPOS]).toEqual([
      "expressjs/express",
      "sindresorhus/ky",
      "sindresorhus/got",
    ]);
    for (const repo of EVAL_REPOS) {
      expect(EVAL_DATASET.filter((c) => c.repo === repo)).toHaveLength(10);
    }
  });

  it("gives every case a unique id and a non-empty question and expectation", () => {
    const ids = new Set(EVAL_DATASET.map((c) => c.id));
    expect(ids.size).toBe(EVAL_DATASET.length);
    for (const testCase of EVAL_DATASET) {
      expect(testCase.question.trim().length).toBeGreaterThan(0);
      expect(testCase.expectedFile.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses repo-relative expected paths, since ingestion writes filePath verbatim", () => {
    for (const testCase of EVAL_DATASET) {
      expect(testCase.expectedFile.startsWith("/")).toBe(false);
      expect(testCase.expectedFile).toContain(".");
    }
  });

  it("does not expect a file twice within one repo", () => {
    for (const repo of EVAL_REPOS) {
      const files = EVAL_DATASET.filter((c) => c.repo === repo).map((c) => c.expectedFile);
      expect(new Set(files).size).toBe(files.length);
    }
  });
});
