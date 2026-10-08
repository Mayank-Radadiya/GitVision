import { describe, expect, it } from "vitest";
import { describeIndexHealth } from "@/src/features/projects/components/project-view/overview/index-health";
import { describeTrend } from "@/src/features/projects/components/project-view/overview/activity-panel";
import { ageTone } from "@/src/features/projects/components/project-view/overview/work-items";
import { fallbackColor } from "@/src/features/projects/components/project-view/overview/composition";
import { initials } from "@/src/features/projects/components/project-view/overview/top-contributors";

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