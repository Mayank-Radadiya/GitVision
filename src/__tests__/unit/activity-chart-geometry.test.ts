import { describe, expect, it } from "vitest";
import {
  PLOT_PADDING,
  axisMaxFor,
  buildGeometry,
  nearestIndexFromPx,
  smoothPath,
  xFor,
  xTickCountFor,
  xTickIndicesFor,
  yFor,
  type ActivityPoint,
} from "@/src/features/projects/components/project-view/charts/activity-geometry";

const series = (values: number[]): ActivityPoint[] =>
  values.map((commits, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    commits,
  }));

const geometryFor = (
  values: number[],
  size: { width: number; height: number } = { width: 640, height: 132 },
  prior?: number[],
) =>
  buildGeometry({
    width: size.width,
    height: size.height,
    series: series(values),
    prior: prior ? series(prior) : undefined,
  });

describe("axisMaxFor", () => {
  it("rounds up to a number a human would choose for a gridline", () => {
    // Load-bearing: the old chart took a raw max, so a peak of 7 drew its top
    // gridline at 7 and every intermediate line at 1.75. Gridlines have to land
    // on round values or the axis is lying about where the values are.
    expect(axisMaxFor(7)).toBe(8);
    expect(axisMaxFor(23)).toBe(25);
    expect(axisMaxFor(240)).toBe(250);
  });

  it("keeps the series filling most of the plot", () => {
    // The previous ladder was 1/2/5/10, which sent a peak of 23 to 50 — the
    // series filled under half the plot and the docstring's "within 50%" was
    // simply not true. The claim is asserted rather than assumed.
    for (const peak of [1, 3, 7, 23, 47, 240, 999, 4321]) {
      expect(axisMaxFor(peak) / peak).toBeLessThanOrEqual(1.25);
    }
  });

  it("always leaves headroom so the peak never sits on the ceiling", () => {
    for (const peak of [1, 5, 10, 11, 50, 100, 999, 1000, 4321]) {
      expect(axisMaxFor(peak)).toBeGreaterThan(peak);
    }
  });

  it("gives an all-zero series a positive axis rather than dividing by zero", () => {
    // A zero axisMax would make every yFor() a NaN and the area path would vanish.
    expect(axisMaxFor(0)).toBeGreaterThan(0);
    expect(axisMaxFor(-5)).toBeGreaterThan(0);
  });
});

describe("buildGeometry", () => {
  it("maps zero to the baseline and the axis max to the plot top", () => {
    const geometry = geometryFor([0, 5, 10]);
    const { baseline, top } = geometry.plot;
    expect(yFor(geometry, 0)).toBeCloseTo(baseline);
    expect(yFor(geometry, geometry.axisMax)).toBeCloseTo(top);
  });

  it("scales from a zero baseline so a quiet day cannot look like no day", () => {
    const geometry = geometryFor([2, 9]);
    // Screen y grows downward, so a *higher* value is a *smaller* y. Asserted in
    // that direction deliberately: getting this backwards is exactly the mistake
    // that would make the area chart render upside down.
    expect(yFor(geometry, 9)).toBeLessThan(yFor(geometry, 2));
    expect(yFor(geometry, 2)).toBeLessThan(geometry.plot.baseline);
  });

  it("scales the prior window into the same space as the current window", () => {
    // The two series are the same unit, so they must share one axis. Separate
    // auto-scaling made the dashed comparison line a decorative shape.
    const current = geometryFor([4, 6, 8]);
    const withPrior = buildGeometry({
      width: 640,
      height: 132,
      series: series([4, 6, 8]),
      prior: series([40, 60, 80]),
    });
    // A prior window ten times larger must stretch the shared axis, not overflow.
    expect(withPrior.axisMax).toBeGreaterThan(current.axisMax);
    expect(yFor(withPrior, 80)).toBeGreaterThanOrEqual(withPrior.plot.top);
    expect(yFor(withPrior, 80)).toBeLessThan(withPrior.plot.baseline);
    // And the current window must still be readable, not squashed onto the floor.
    expect(yFor(withPrior, 8)).toBeLessThan(withPrior.plot.baseline);
  });

  it("keeps the plot inside its padded rect at any width", () => {
    for (const width of [40, 120, 320, 640, 1440]) {
      const geometry = geometryFor([1, 2, 3], { width, height: 132 });
      expect(geometry.plot.left).toBe(PLOT_PADDING.left);
      expect(geometry.plot.right).toBe(width - PLOT_PADDING.right);
      expect(geometry.plot.right).toBeGreaterThan(geometry.plot.left);
    }
  });

  it("never produces a degenerate rect from a zero-sized container", () => {
    // The measured width is 0 on the first paint and in jsdom, so every
    // coordinate below has to stay finite or the first frame renders NaN paths.
    const geometry = geometryFor([3, 1], { width: 0, height: 0 });
    expect(geometry.plot.right).toBeGreaterThanOrEqual(geometry.plot.left);
    expect(geometry.plot.baseline).toBeGreaterThanOrEqual(geometry.plot.top);
    expect(Number.isFinite(yFor(geometry, 2))).toBe(true);
  });

  it("spaces y ticks evenly and always labels the baseline", () => {
    const geometry = geometryFor([1, 4, 9, 2, 6], { width: 640, height: 200 });
    expect(geometry.ticks.length).toBeGreaterThanOrEqual(3);
    expect(geometry.ticks[0]!.label).toBe("0");
    const gaps = geometry.ticks
      .slice(1)
      .map((tick, index) => geometry.ticks[index]!.y - tick.y);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6);
  });

  it("labels only numbers a person would say out loud", () => {
    // Regression: a 25-max axis cut into four bands printed 0/6.25/12.5/18.75/25.
    // Every one of those is a real value and none of them reads as a count of
    // commits. The rule is now "whole, or one decimal place, or nothing".
    for (const peak of [3, 9, 17, 23, 25, 60, 130, 900]) {
      const geometry = geometryFor([peak], { width: 640, height: 132 });
      for (const tick of geometry.ticks) {
        if (tick.label === null) continue;
        expect(tick.label).not.toMatch(/\.\d\d/);
        expect(Number(tick.label.replace("k", "")) * 10).toBe(
          Math.round(Number(tick.label.replace("k", "")) * 10),
        );
      }
    }
  });

  it("always labels the baseline and the axis max, whatever the peak", () => {
    // The two edges are the numbers a reader actually quotes. They are clean by
    // construction because axisMax comes off a nice-number ladder, and they must
    // survive even when no interior band divides the axis evenly.
    for (const peak of [1, 3, 6, 11, 23, 47, 130, 900]) {
      const geometry = geometryFor([peak], { width: 640, height: 132 });
      const labels = geometry.ticks.map((tick) => tick.label);
      expect(labels[0]).toBe("0");
      expect(labels[labels.length - 1]).not.toBeNull();
      // …and every interior label, if any, is a clean number.
      for (const label of labels.slice(1, -1)) {
        if (label !== null) expect(label).not.toMatch(/\.\d\d/);
      }
    }
  });

  it("labels every tick on the default plot height when the steps are whole", () => {
    // Regression: the old label gate needed 34px per band, so the 132px default
    // plot could only ever label its baseline and its top line.
    const geometry = geometryFor([23], { width: 640, height: 132 });
    expect(geometry.axisMax).toBe(25);
    const labels = geometry.ticks.map((tick) => tick.label);
    expect(labels).toEqual(["0", "5", "10", "15", "20", "25"]);
  });
});

describe("xTickCountFor", () => {
  it("drops tick density as the container narrows so labels never collide", () => {
    // At a narrow width a 7-day window must not try to draw seven weekday
    // initials; they would overlap into an unreadable smear.
    const wide = xTickCountFor(1400, 30);
    const narrow = xTickCountFor(200, 30);
    expect(narrow).toBeLessThan(wide);
    expect(narrow).toBeGreaterThanOrEqual(2);
  });

  it("never asks for more ticks than there are days", () => {
    expect(xTickCountFor(4000, 7)).toBe(7);
  });

  it("returns zero for an empty window instead of throwing", () => {
    expect(xTickCountFor(640, 0)).toBe(0);
  });
});

describe("xTickIndicesFor", () => {
  it("always includes the first and last day", () => {
    // The two ends are what make a window legible at a glance — "which day is
    // today" — so they are the one pair that cannot be dropped for density.
    for (const [width, days] of [
      [1400, 30],
      [640, 30],
      [320, 90],
      [200, 7],
    ] as const) {
      const indices = xTickIndicesFor(width, days);
      expect(indices[0]).toBe(0);
      expect(indices[indices.length - 1]).toBe(days - 1);
    }
  });

  it("puts the ticks on whole days, never between them", () => {
    const indices = xTickIndicesFor(1400, 30);
    for (const index of indices) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(29);
    }
  });

  it("never repeats an index across a long window", () => {
    const indices = xTickIndicesFor(4000, 90);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it("returns nothing for an empty window", () => {
    expect(xTickIndicesFor(640, 0)).toEqual([]);
  });
});

describe("xFor", () => {
  it("puts the first day at the left edge and the last at the right", () => {
    const geometry = geometryFor([1, 2, 3, 4, 5]);
    expect(xFor(geometry, 0, 5)).toBeCloseTo(geometry.plot.left);
    expect(xFor(geometry, 4, 5)).toBeCloseTo(geometry.plot.right);
  });

  it("advances monotonically so the line never doubles back", () => {
    const geometry = geometryFor([1, 2, 3, 4, 5, 6, 7]);
    const xs = [0, 1, 2, 3, 4, 5, 6].map((i) => xFor(geometry, i, 7));
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
  });

  it("centres a single-day series rather than pinning it to an edge", () => {
    // A one-commit window drawn flush against the left axis reads as "the trend
    // ended here and nothing followed", which is a claim the data does not make.
    const geometry = geometryFor([9]);
    const { left, right } = geometry.plot;
    expect(xFor(geometry, 0, 1)).toBeCloseTo((left + right) / 2);
  });
});

describe("nearestIndexFromPx", () => {
  const geometry = geometryFor([1, 2, 3, 4, 5, 6, 7]);
  const days = 7;

  it("snaps to the nearest day", () => {
    const { left, right } = geometry.plot;
    const step = (right - left) / (days - 1);
    expect(nearestIndexFromPx(geometry, left + step * 0.9, days)).toBe(1);
    expect(nearestIndexFromPx(geometry, left + step * 1.4, days)).toBe(1);
    expect(nearestIndexFromPx(geometry, left + step * 1.6, days)).toBe(2);
  });

  it("clamps at both ends instead of wrapping or going negative", () => {
    // Pointer-tracking used to index straight into the array, so hovering the
    // left margin selected the last day. That reads as "today" for a 30-day
    // window and is simply wrong.
    expect(nearestIndexFromPx(geometry, -500, days)).toBe(0);
    expect(nearestIndexFromPx(geometry, 5000, days)).toBe(days - 1);
  });

  it("round-trips every day's own x position back to that day", () => {
    // This is the invariant that makes keyboard stepping and hover agree: both
    // resolve through this one function, so neither can disagree with the other.
    for (let index = 0; index < days; index++) {
      expect(nearestIndexFromPx(geometry, xFor(geometry, index, days), days)).toBe(index);
    }
  });

  it("has no day to point at in an empty window", () => {
    expect(nearestIndexFromPx(geometry, 100, 0)).toBe(-1);
  });
});

describe("smoothPath", () => {
  it("emits a move-then-curve path for a two-point series", () => {
    expect(smoothPath([{ x: 0, y: 10 }, { x: 20, y: 0 }])).toMatch(/^M[\d.]+,[\d.]+ C/);
  });

  it("passes through every data point rather than near it", () => {
    // Each segment ends exactly on its endpoint, so the curve interpolates the
    // series instead of merely approximating it.
    const points = [
      { x: 0, y: 10 },
      { x: 20, y: 4 },
      { x: 40, y: 12 },
    ];
    const path = smoothPath(points);
    expect(path.startsWith("M0,10")).toBe(true);
    expect(path).toContain("20,4");
    expect(path.endsWith("40,12")).toBe(true);
  });

  it("emits nothing for an empty series", () => {
    expect(smoothPath([])).toBe("");
  });

  it("stays finite for a single point", () => {
    expect(smoothPath([{ x: 5, y: 5 }])).not.toContain("NaN");
  });
});