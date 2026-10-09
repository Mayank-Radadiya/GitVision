"use client";

/**
 * SegmentedBar — a proportional bar split into labelled, coloured bands.
 *
 * ── Why it is its own component ──────────────────────────────────────────────
 * Three surfaces on the overview need the same primitive: index coverage
 * (embedded / skipped / not considered), the age distribution of open work
 * (four bands), and contributor share. Each was going to be a small bespoke bar,
 * and each bespoke bar is a place for the rounding and the minimum-visible-width
 * rule to be re-decided slightly differently — which is exactly how a set of
 * bars on one screen starts disagreeing about what a 1% sliver looks like.
 *
 * Two rules are inherited from `coverage-meter.tsx`, where they were already
 * load-bearing, and are the reason this is factored rather than written three
 * more times:
 *
 *   1. **A non-zero band is never narrower than 0.5%.** Without a floor, a
 *      project with one skipped file out of four thousand renders a band that
 *      rounds to zero pixels and silently disappears. The band is a fact about
 *      the project; if it is non-zero it gets drawn.
 *   2. **Widths are percentages of an explicit `total`, never of the sum of the
 *      bands shown.** A caller with a remainder category (coverage has one —
 *      "not considered") has to be able to pass a total those bands do not sum
 *      to, or the bar would overflow its track.
 *
 * ── Why there is no mount animation here ─────────────────────────────────────
 * This was a `motion.span` animating in from `width: 0`, which is wrong twice
 * over. The server renders the `initial` state, so every band shipped `width:0`
 * — the meters were blank until hydration, which contradicts rule 1 above: a
 * non-zero band has to be drawn, not merely intended. And `initial={{ width: 0 }}`
 * is a number (so `0px`) while `animate` is a percentage, so the animation
 * asked framer-motion to interpolate between two different units.
 *
 * The bands now render their real widths directly and carry a CSS transition,
 * which still animates the case that matters — the numbers changing under a
 * re-sync or a refetch — without a window where the figure is missing.
 */

import { memo } from "react";
import { cn } from "@/shared/lib/utils";

export interface Segment {
  /** Stable identity for React keys and for filtering zero-valued bands. */
  key: string;
  value: number;
  /** Tailwind background class. Passed as a class, not resolved, so the token
   *  stays themable — see the `--gv-moss/--gv-amber/--gv-wire` aliases. */
  className: string;
}

export interface SegmentedBarProps {
  segments: Segment[];
  /**
   * What the band widths are measured against. Defaults to the sum of
   * `segments`; pass an explicit value when the bands are a subset.
   */
  total?: number;
  /** Full sentence for assistive tech, since the bar itself is not readable. */
  ariaLabel: string;
  className?: string;
  /** Bar thickness. `h-2` for meters, thinner for inline use. */
  barClassName?: string;
}

/**
 * Percentage of `total`, with a floor so any non-zero band stays visible.
 *
 * Exported because the age histogram asserts on these percentages directly: a
 * band can round to the same string as its neighbour, and the test needs to be
 * able to check that the cumulative offsets still sum correctly.
 */
export function bandWidth(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.max((value / total) * 100, value > 0 ? 0.5 : 0)}%`;
}

/** Cumulative left offsets, so bands stack left-to-right without a flex gap. */
function offsetsFor(segments: Segment[], total: number): number[] {
  let running = 0;
  return segments.map((segment) => {
    const offset = running;
    running += total > 0 ? (segment.value / total) * 100 : 0;
    return offset;
  });
}

function SegmentedBar({
  segments,
  total,
  ariaLabel,
  className,
  barClassName,
}: SegmentedBarProps) {
  const resolvedTotal =
    total ?? segments.reduce((sum, segment) => sum + segment.value, 0);
  // Zero-valued bands are dropped rather than rendered as a zero-width element:
  // an empty absolutely-positioned span is still a paint target and a hit region.
  const visible = segments.filter((segment) => segment.value > 0);
  const offsets = offsetsFor(visible, resolvedTotal);

  return (
    <div
      className={cn(
        "bg-muted/60 relative overflow-hidden rounded-full",
        barClassName ?? "h-2",
        className,
      )}
      role="img"
      aria-label={ariaLabel}
    >
      {resolvedTotal > 0 &&
        visible.map((segment, index) => (
          <span
            key={segment.key}
            className={cn(
              "absolute inset-y-0 transition-[width,left] duration-500 ease-out",
              segment.className,
              // Only the outermost visible band rounds the end it is on.
              index === 0 && "rounded-l-full",
              index === visible.length - 1 && "rounded-r-full",
            )}
            style={{
              width: bandWidth(segment.value, resolvedTotal),
              left: `${offsets[index]}%`,
            }}
          />
        ))}
    </div>
  );
}

export { SegmentedBar };
export default memo(SegmentedBar);