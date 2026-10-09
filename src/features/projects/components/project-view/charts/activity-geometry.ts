/**
 * Activity-chart geometry.
 *
 * Every function here is pure and framework-free: it takes numbers and returns
 * numbers. That is deliberate, and it is the reason this is a separate module.
 *
 * ── Why this is factored out ─────────────────────────────────────────────────
 * T-099's own record of the previous activity chart says it was "not verified in
 * a browser — the chart primitives have no rendered-output assertions". A
 * `<svg>` in jsdom asserts nothing useful: it renders no geometry, so a test
 * over the component can only check that it does not throw. Putting the maths
 * here instead means the part that is actually wrong when a chart is wrong —
 * scale, tick placement, hit-testing — is covered by ordinary unit tests, and the
 * component is reduced to drawing what it is told.
 *
 * The module is `.ts` rather than `.tsx` precisely so it cannot accidentally
 * acquire a React import and become untestable.
 *
 * ── The scaling model, and why it changed ────────────────────────────────────
 * The previous chart drew into `viewBox="0 0 300 h"` with
 * `preserveAspectRatio="none"`, then leaned on `vectorEffect="non-scaling-stroke"`
 * to stop the strokes from distorting. That works for a stroke, and only for a
 * stroke: under a non-uniform scale the same transform stretches dash patterns,
 * rounds end dots into ellipses, and scales text — for which there is no
 * vector-effect fix at all. The old file said as much and worked around it by
 * keeping all text in HTML.
 *
 * The trade was reasonable when the goal was a sparkline-ish area with no axis.
 * It stops being reasonable the moment the chart needs a y-axis, a variable
 * number of x-ticks, or a hit target the reader aims rather than brushes over.
 * So the plot is now drawn at real pixel dimensions: x and y scale by the same
 * factor, dots are circles, and dash arrays are in real units. The cost is that
 * the chart has to know its own width — see `use-element-size.ts`.
 */

/** One day in the series. */
export interface ActivityPoint {
  date: string;
  commits: number;
}

/** A horizontal gridline at a known value. */
export interface AxisTick {
  /** Pixel y of the gridline. */
  y: number;
  /** The value it represents. */
  value: number;
  /** Label to render, or `null` when the line is drawn but not labelled. */
  label: string | null;
}

export interface PlotRect {
  /** Pixel x of the first day. */
  left: number;
  /** Pixel x of the last day. */
  right: number;
  /** Pixel y of the value-zero baseline. */
  baseline: number;
  /** Pixel y of the axis top. */
  top: number;
}

export interface ChartGeometry {
  plot: PlotRect;
  /** Y of each gridline, top to bottom. */
  ticks: AxisTick[];
  /** The rounded maximum the y scale is built on. */
  axisMax: number;
  /** X tick marks along the bottom, as indices into the series. */
  xTickIndices: number[];
}

/** Padding inside the chart box. Right padding makes room for the y labels. */
export const PLOT_PADDING = { top: 8, right: 26, bottom: 18, left: 0 } as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rounds an axis top up to a readable step.
 *
 * Gridlines should land on numbers a person would have chosen — 10, 25, 50 — not
 * on whatever the busiest day happened to be.
 *
 * Two properties are load-bearing and asserted in
 * `src/__tests__/unit/activity-chart-geometry.test.ts`:
 *
 *  1. **Bounded waste.** Every adjacent pair in `AXIS_STEPS` differs by at most
 *     1.25×, so the axis top is never more than 25% above the peak and the series
 *     always fills at least four fifths of the plot height. The previous version's
 *     1 / 2 / 5 / 10 ladder could not honour this — a peak of 23 became 50, under
 *     half the plot — while its docstring claimed "within 50%", which was simply
 *     untrue. The half-steps here are for the same reason they exist on real axes.
 *
 *  2. **Strict headroom.** An exact ladder hit steps one rung higher, so a peak
 *     of 10 or 100 does not sit on the top gridline. A line touching the ceiling
 *     reads as clipped and gives the reader no room to see that the peak is the
 *     peak. This is also why the ladder is dense between 3 and 10 rather than
 *     4/5/6/8/10: with a coarser tail a peak of 5 had to jump to 8 to gain
 *     headroom, which is the 1.6× waste property 1 forbids.
 */
const AXIS_STEPS = [
  1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10,
] as const;

export function axisMaxFor(raw: number): number {
  // `Math.log10(0)` is -Infinity, so the magnitude has to be guarded before it.
  if (!(raw > 0)) return 2;

  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const ceiling = AXIS_STEPS.findIndex(
    (candidate) => candidate >= normalized - Number.EPSILON,
  );
  // An exact ladder hit means the peak *is* 1, 10 or 100. Step one rung higher so
  // the axis never lands on the peak itself.
  const last = AXIS_STEPS.length - 1;
  const step =
    ceiling === -1
      ? AXIS_STEPS[last]!
      : AXIS_STEPS[
          Math.min(ceiling + (AXIS_STEPS[ceiling]! <= normalized ? 1 : 0), last)
        ]!;
  return step * magnitude;
}

/**
 * How many x-axis labels a window can carry without them colliding.
 *
 * Each label is "Mar 14" — about 44px in the mono face at 10px. A label needs
 * roughly that much of the axis, so the count is the usable width over the
 * per-label budget, floored at 2 (start and end) and capped at the series length.
 */
export function xTickCountFor(width: number, days: number): number {
  if (days <= 0) return 0;
  const usable = Math.max(0, width - PLOT_PADDING.right - PLOT_PADDING.left);
  const perLabel = 52;
  return clamp(Math.floor(usable / perLabel), 2, days);
}

/**
 * Picks which day indices get an x-axis label.
 *
 * Always includes the first and last day — those are the two that make the
 * window legible at a glance — and spreads the rest evenly between them. Even
 * spacing is done by step rather than by slicing the array at equal fractions,
 * because a 7-day window wants ticks at 0/2/4/6 (indices 0, 3, 6) and a
 * division-by-6 would put them mid-day instead.
 */
export function xTickIndicesFor(
  width: number,
  days: number,
): number[] {
  const count = xTickCountFor(width, days);
  if (days === 0 || count === 0) return [];
  if (count <= 2) return Array.from({ length: days }, (_, i) => i);

  const step = (days - 1) / (count - 1);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.round(i * step);
    // `Round` can repeat an index for short series with dense tick counts.
    if (indices[indices.length - 1] !== index) indices.push(index);
  }
  return indices;
}

/** Shorthand label for a gridline: 1200 → "1.2k", 20 → "20". */
function tickLabel(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return String(value);
}

/**
 * Whether a gridline sits on a number a person would say out loud.
 *
 * `Number.isInteger(value * 10)` accepts "20" and "12.5" and rejects "6.25".
 * The earlier density-only band count produced a step of 6.25 on a 25-max axis,
 * which is a real value and a useless label — the axis stopped reading as
 * counts. An unlabelled line is a better failure than a line labelled with a
 * number nobody would write.
 */
function isCleanTick(value: number): boolean {
  return Number.isInteger(value * 10);
}

/**
 * How many bands to cut the axis into.
 *
 * Height says how many will *fit*; divisibility says how many will read well.
 * A count that divides the axis into whole steps wins over a count that merely
 * fits, so a 25-max axis lands on five bands (0/5/10/15/20/25) rather than four
 * (0/6.25/12.5/18.75/25).
 */
function tickCountFor(axisMax: number, plotHeight: number): number {
  const fits = Math.min(5, Math.max(2, Math.round(plotHeight / 30) + 1));
  for (const candidate of [fits, 5, 4, 3, 2] as const) {
    if (candidate > fits) continue; // never exceed what the height allows
    if (axisMax % candidate === 0) return candidate;
  }
  return fits;
}

/**
 * Builds every coordinate the chart draws from.
 *
 * Takes the measured width rather than reading it, so the whole mapping is a
 * pure function of (width, height, series, prior) and is testable directly.
 *
 * The y scale spans `0..axisMax` rather than `min..max`: commit counts have a
 * meaningful zero, and a non-zero baseline would exaggerate the difference
 * between a quiet day and a busier one.
 */
export function buildGeometry({
  width,
  height,
  series,
  prior,
}: {
  width: number;
  height: number;
  series: ActivityPoint[];
  prior?: ActivityPoint[];
}): ChartGeometry {
  const days = series.length;
  const plotWidth = Math.max(1, width - PLOT_PADDING.left - PLOT_PADDING.right);
  const plotHeight = Math.max(1, height - PLOT_PADDING.top - PLOT_PADDING.bottom);

  const left = PLOT_PADDING.left;
  const right = left + plotWidth;
  const top = PLOT_PADDING.top;
  const baseline = top + plotHeight;

  const peak = Math.max(
    0,
    ...series.map((point) => point.commits),
    ...(prior ?? []).map((point) => point.commits),
  );
  const axisMax = axisMaxFor(peak);

  const tickCount = tickCountFor(axisMax, plotHeight);
  const ticks: AxisTick[] = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = (axisMax / tickCount) * i;
    const y = baseline - (value / axisMax) * plotHeight;
    // The two edges are always labelled. They are the numbers a reader actually
    // quotes, and axisMax comes off a nice-number ladder so it is clean by
    // construction — 1.25 for a repo whose busiest day was one commit is a
    // perfectly good axis top, and suppressing it would leave the scale with no
    // maximum at all. Interior ticks must additionally sit on a number a person
    // would say out loud: whole, or one decimal place, or nothing. 14px is about
    // one line of 10px type plus air; the previous 34px gate was so
    // conservative that a five-band axis on the default 132px plot could only
    // ever label its two edges.
    const isEdge = i === 0 || i === tickCount;
    const label =
      isEdge || (isCleanTick(value) && plotHeight / tickCount >= 14)
        ? tickLabel(value)
        : null;
    return { y, value, label };
  });

  return {
    plot: { left, right, baseline, top },
    ticks,
    axisMax,
    xTickIndices: xTickIndicesFor(width, days),
  };
}

/** Pixel x for a day index. A single-day series is centred on the plot. */
export function xFor(geometry: ChartGeometry, index: number, days: number): number {
  const { left, right } = geometry.plot;
  if (days <= 1) return (left + right) / 2;
  return left + (index / (days - 1)) * (right - left);
}

/** Pixel y for a commit count. */
export function yFor(geometry: ChartGeometry, value: number): number {
  const { baseline, top } = geometry.plot;
  const span = baseline - top;
  return baseline - (value / geometry.axisMax) * span;
}

/**
 * The day index nearest a pointer position.
 *
 * Snaps to the nearest day and clamps at both ends, so a pointer left of the
 * first day reads that day rather than going negative and wrapping. Used for
 * both pointer and keyboard, which is what makes arrow-key inspection agree
 * with hover instead of behaving as a second, subtly different interaction.
 */
export function nearestIndexFromPx(
  geometry: ChartGeometry,
  x: number,
  days: number,
): number {
  if (days <= 0) return -1;
  if (days === 1) return 0;
  const { left, right } = geometry.plot;
  const span = right - left;
  if (span <= 0) return 0;
  const fraction = (x - left) / span;
  return clamp(Math.round(fraction * (days - 1)), 0, days - 1);
}

/**
 * Catmull-Rom → cubic Bézier, so a sparse week reads as a curve not a zigzag.
 *
 * The control points sit at the midpoint of each segment's x span and at the
 * endpoints' own y, which is the standard centripetal-ish flattening: it passes
 * exactly through every data point (unlike a plain Catmull-Rom control
 * derivation) and cannot overshoot into a value that was never measured.
 */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;

  let path = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]!;
    const next = points[i + 1]!;
    const midX = (current.x + next.x) / 2;
    path += ` C${midX},${current.y} ${midX},${next.y} ${next.x},${next.y}`;
  }
  return path;
}

/** Closes a line path down to the baseline to make a fillable area. */
export function areaPathFor(
  geometry: ChartGeometry,
  linePath: string,
  days: number,
): string {
  if (days === 0 || !linePath) return "";
  return `${linePath} L${xFor(geometry, days - 1, days)},${geometry.plot.baseline} L${xFor(geometry, 0, days)},${geometry.plot.baseline} Z`;
}