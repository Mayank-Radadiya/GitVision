import { describe, expect, it } from "vitest";
import { describeIndexHealth } from "@/src/features/projects/components/project-view/overview/index-health";
import { describeTrend } from "@/src/features/projects/components/project-view/overview/activity-panel";
import { ageTone } from "@/src/features/projects/components/project-view/overview/work-items";
import { fallbackColor } from "@/src/features/projects/components/project-view/overview/composition";
import { initials } from "@/src/features/projects/components/project-view/overview/top-contributors";
import { describeIndexEconomy } from "@/src/features/projects/components/project-view/overview/index-health";
import { describeAgeDistribution } from "@/src/features/projects/components/project-view/overview/work-items";
import { describeRecency } from "@/src/features/projects/components/project-view/overview/recent-activity";
import { describeSyncFreshness } from "@/src/features/projects/components/project-view/overview/repo-vitals";
import { bandWidth } from "@/src/features/projects/components/project-view/charts/segmented-bar";
import { truncateSubject } from "@/src/features/dashboard/server/router/services/projectService";

describe("describeIndexHealth", () => {
  const counts = { embedded: 900, skipped: 300, unconsidered: 1500 };

  it("calls a fully covered index ready", () => {
    const health = describeIndexHealth("completed", {
      embedded: 1200,
      skipped: 0,
      unconsidered: 0,
    });
    expect(health.tone).toBe("ready");
    expect(health.label).toBe("Ready");
    expect(health.headline).toContain("1,200");
  });

  it("treats partial as a working index, not a failure", () => {
    const health = describeIndexHealth("partial", counts);
    // The load-bearing assertion. `partial` is a searchable index over a capped
    // subset — docs/indexing-status.ts is explicit that it is NOT a failure, and
    // the previous revision of this component's neighbour rendered it in the same
    // red as `failed`, which told users to re-sync a healthy project.
    expect(health.tone).toBe("warning");
    expect(health.tone).not.toBe("critical");
    expect(health.headline).toContain("300");
    expect(health.headline).toContain("1,500");
  });

  it("reports progress and queueing as in-flight rather than as damage", () => {
    expect(describeIndexHealth("processing", counts).tone).toBe("working");
    expect(describeIndexHealth("pending", counts).tone).toBe("working");
  });

  it("marks a failed index critical", () => {
    expect(describeIndexHealth("failed", counts).tone).toBe("critical");
  });

  it("degrades an unrecognised status instead of throwing or blanking", () => {
    // The column is a bare varchar, so a future status is reachable without a
    // migration; "no news" is the only safe reading of one.
    expect(describeIndexHealth("quarantined", counts).tone).toBe("idle");
    expect(describeIndexHealth(undefined, counts).tone).toBe("idle");
    expect(describeIndexHealth(null, counts).tone).toBe("idle");
  });

  it("does not claim a file count when nothing has been counted", () => {
    const health = describeIndexHealth("completed", {
      embedded: 0,
      skipped: 0,
      unconsidered: 0,
    });
    expect(health.headline).toContain("no files counted");
    expect(health.headline).not.toContain("0 of 0");
  });
});

describe("describeTrend", () => {
  const at = (commitsInWindow: number, priorWindowCommits: number) =>
    describeTrend({ commitsInWindow, priorWindowCommits, activeDays: 0 });

  it("reads growth as up", () => {
    expect(at(120, 100).direction).toBe("up");
    expect(at(120, 100).fraction).toBeCloseTo(0.2);
  });

  it("reads decline as down", () => {
    expect(at(80, 100).direction).toBe("down");
    expect(at(80, 100).fraction).toBeCloseTo(-0.2);
  });

  it("rounds to flat when the change rounds away", () => {
    // 1000 → 1004 is +0.4%. Reporting "+0.4%" on a dashboard next to a chart is
    // noise, and it would disagree with the eye.
    expect(at(1004, 1000).direction).toBe("flat");
  });

  it("has no percentage for activity out of nothing", () => {
    const trend = at(12, 0);
    expect(trend.direction).toBe("new");
    // +∞ is not a number a person can read. The UI must not try to print one.
    expect(trend.fraction).toBeNull();
    expect(trend.label).not.toContain("∞");
    expect(trend.label).not.toContain("%");
  });

  it("reports an empty pair of windows as idle rather than a −100% collapse", () => {
    expect(at(0, 0).direction).toBe("idle");
    expect(at(0, 0).label).toBe("No activity");
  });
});

describe("ageTone", () => {
  it("escalates with age and treats no open items as neutral", () => {
    expect(ageTone(3).className).toContain("gv-moss");
    expect(ageTone(20).className).toContain("gv-moss");
    expect(ageTone(60).className).toContain("gv-amber");
    expect(ageTone(400).className).toContain("gv-ember");
    expect(ageTone(null).label).toBe("No open items");
  });
});

describe("fallbackColor", () => {
  it("is stable for the same language", () => {
    expect(fallbackColor("Zig")).toBe(fallbackColor("Zig"));
  });

  it("is achromatic so a nameless language cannot read as a status colour", () => {
    // The `gv-*` tokens on this page mean ready / ageing / stale. A language
    // segment borrowing that vocabulary would be read as a health signal.
    expect(fallbackColor("Zig")).toMatch(/^hsl\(0 0% \d+%\)$/);
    expect(fallbackColor("Zig")).not.toContain("gv-");
  });
});

describe("initials", () => {
  it("reads two names, one name, and nothing usable", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    // The domain is dropped before splitting, so an address cannot yield the
    // initials of "example.com".
    expect(initials("ada.lovelace@example.com")).toBe("AL");
    expect(initials("1234+noreply@github.com")).toBe("12");
    expect(initials("ada")).toBe("AD");
    expect(initials("   ")).toBe("?");
  });
});

describe("describeIndexEconomy", () => {
  it("derives the chunker's packing density from two aggregates", () => {
    const economy = describeIndexEconomy({ chunks: 100, tokens: 15_000, indexedFiles: 250 });
    expect(economy).toEqual({ tokensPerChunk: 150, chunksPerFile: 0.4 });
  });

  it("reports chunks per file, not files per chunk", () => {
    // The ratio used to run the other way, which made every properly-indexed
    // project render a flat "0.0": a 1,255-token chunker splits a file into
    // tens of chunks, so files-per-chunk is always a fraction near zero.
    const economy = describeIndexEconomy({
      chunks: 48_920,
      tokens: 61_400_000,
      indexedFiles: 1_240,
    });
    expect(economy?.chunksPerFile).toBeCloseTo(39.5, 1);
    expect(economy?.tokensPerChunk).toBe(1_255);
  });

  it("refuses to divide by an empty index rather than reporting infinity", () => {
    // A just-created project has zero chunks. Infinity in a ratio row reads as a
    // measurement, and it is a division by nothing.
    expect(describeIndexEconomy({ chunks: 0, tokens: 0 })).toBeNull();
    expect(describeIndexEconomy({ chunks: 10, tokens: 0 })).toBeNull();
    expect(describeIndexEconomy({ chunks: 0, tokens: 500 })).toBeNull();
    expect(describeIndexEconomy({})).toBeNull();
  });

  it("distinguishes an unknown file count from a zero-density index", () => {
    // Tokens are known but the file count is not. Zero would assert that every
    // chunk holds a whole file, which is a different and much stronger claim.
    const economy = describeIndexEconomy({ chunks: 10, tokens: 1_000 });
    expect(economy?.tokensPerChunk).toBe(100);
    expect(economy?.chunksPerFile).toBeNull();
  });
});

describe("describeAgeDistribution", () => {
  const buckets = { fresh: 4, aging: 3, stale: 2, dormant: 1 };

  it("segments every band and totals them", () => {
    const distribution = describeAgeDistribution(buckets, 10);
    expect(distribution?.total).toBe(10);
    expect(distribution?.segments).toHaveLength(4);
  });

  it("reads the distribution as healthy when most items are recent", () => {
    const distribution = describeAgeDistribution({ fresh: 9, aging: 1, stale: 0, dormant: 0 }, 10);
    expect(distribution?.worst?.key).toBe("aging");
  });

  it("flags a backlog that has stopped turning over", () => {
    // The finding this band exists to surface: the same open count is healthy or
    // not depending on how old the items are.
    const distribution = describeAgeDistribution({ fresh: 0, aging: 0, stale: 0, dormant: 12 }, 12);
    expect(distribution?.worst?.key).toBe("dormant");
    expect(distribution?.worstSentence).toContain("12");
  });

  it("renders nothing when the buckets disagree with the open total", () => {
    // The bands and the headline count come from the same statement today. If a
    // future change splits them, drawing a distribution that sums to a different
    // number than the one printed above it would be worse than drawing none.
    expect(describeAgeDistribution(buckets, 11)).toBeNull();
  });

  it("renders nothing rather than an empty histogram", () => {
    expect(describeAgeDistribution(buckets, 0)).toBeNull();
    expect(describeAgeDistribution({ fresh: 0, aging: 0, stale: 0, dormant: 0 }, 0)).toBeNull();
    expect(describeAgeDistribution(undefined, 10)).toBeNull();
  });
});

describe("bandWidth", () => {
  it("never rounds a real segment out of existence", () => {
    // 1 of 10,000 files would be 0.01%, which a percentage floor would collapse
    // to zero and silently drop from the bar while still counting in the legend.
    expect(bandWidth(1, 10_000)).not.toBe("0%");
  });

  it("emits a parseable percentage", () => {
    expect(bandWidth(3, 12)).toMatch(/^25(\.\d+)?%$/);
  });
});

describe("describeRecency", () => {
  const now = new Date("2026-01-20T12:00:00Z");
  const hoursAgo = (hours: number) =>
    describeRecency(new Date(now.getTime() - hours * 3_600_000), now);

  it("separates a commit this hour from one earlier today", () => {
    expect(hoursAgo(1).recency).toBe("just-now");
    expect(hoursAgo(20).recency).toBe("active");
    expect(hoursAgo(200).recency).toBe("settled");
    expect(hoursAgo(24 * 60).recency).toBe("dormant");
  });

  it("treats a repository with no commits as maximally dormant, never as an error", () => {
    // `lastActivityAt` is null until the first commit syncs, which is a normal
    // state for a brand-new project rather than a fault to report.
    expect(describeRecency(null, now).recency).toBe("dormant");
  });
});

describe("describeSyncFreshness", () => {
  const now = new Date("2026-01-20T12:00:00Z");
  const hoursAgo = (hours: number) =>
    describeSyncFreshness(new Date(now.getTime() - hours * 3_600_000), now);

  it("warns only once a sync is genuinely old", () => {
    // Amber here means the index may be out of date. Used too eagerly it trains
    // the reader to ignore it, and a project synced nine hours ago is normal.
    expect(hoursAgo(0.5).freshness).toBe("fresh");
    expect(hoursAgo(9).freshness).toBe("recent");
    expect(hoursAgo(30).freshness).toBe("stale");
    expect(hoursAgo(30).className).toContain("gv-amber");
  });
});

describe("truncateSubject", () => {
  it("keeps only the subject line of a commit body", () => {
    expect(truncateSubject("fix: keep the cap\n\nLong body explaining why.")).toBe(
      "fix: keep the cap",
    );
  });

  it("caps a long subject without exceeding the cap", () => {
    // T-029 measured `commit_message` averaging 1092 bytes and peaking at 64KB;
    // eight unbounded messages dominated the cost of the panel that fetched them.
    const subject = truncateSubject("a".repeat(400));
    expect(subject.length).toBeLessThanOrEqual(121);
    expect(subject.endsWith("…")).toBe(true);
  });

  it("returns nothing for a missing message rather than the string 'null'", () => {
    expect(truncateSubject(null)).toBe("");
    expect(truncateSubject(undefined)).toBe("");
    expect(truncateSubject("")).toBe("");
  });
});