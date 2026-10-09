"use client";

import { memo, useCallback, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { formatCount } from "@/shared/lib/format";
import {
  buildGeometry,
  nearestIndexFromPx,
  xFor,
  yFor,
  type ActivityPoint,
} from "./activity-geometry";
import { useElementSize } from "./use-element-size";

export type { ActivityPoint };
const chartDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const chartWeekday = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});
const formatDate = (date: string) => chartDate.format(new Date(date));
const formatWeekday = (date: string) => chartWeekday.format(new Date(date));

interface ActivityChartProps {
  /** Dense ascending daily series for the visible window. */
  series: ActivityPoint[];
  /**
   * The preceding window of equal length, aligned by index.
   *
   * Drawn as a dashed ghost rather than a second colour: it is context for the
   * solid line, not a peer of it, and two saturated series would invite the
   * reader to compare them as equals.
   */
  prior?: ActivityPoint[];
  className?: string;
  height?: number;
}

function ActivityChart({
  series,
  prior,
  className,
  height = 132,
}: ActivityChartProps) {
  const { width, ref } = useElementSize();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const days = series.length;
  const base = buildGeometry({ width, height, series, prior });
  const inset = Math.min(
    12,
    ((base.plot.right - base.plot.left) / Math.max(days, 1)) * 0.35,
  );
  const geometry = {
    ...base,
    plot: {
      ...base.plot,
      left: base.plot.left + inset,
      right: base.plot.right - inset,
    },
  };
  const barWidth = Math.max(
    1,
    Math.min(
      24,
      ((geometry.plot.right - geometry.plot.left) / Math.max(days, 1)) * 0.65,
    ),
  );

  // The prior window is aligned by index from the end: it is always the same
  // length as the visible window, so the ghost line's x positions are the
  // visible window's x positions and only its values differ.
  const alignedPrior =
    prior && prior.length >= days ? prior.slice(prior.length - days) : [];
  const priorPath =
    alignedPrior.length === days
      ? alignedPrior
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${xFor(geometry, index, days)} ${yFor(geometry, point.commits)}`,
          )
          .join(" ")
      : "";

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || days === 0) return;
      setActiveIndex(
        nearestIndexFromPx(geometry, event.clientX - rect.left, days),
      );
    },
    [days, geometry],
  );

  const step = useCallback(
    (delta: number | "start" | "end") => {
      setActiveIndex((current) => {
        if (days === 0) return null;
        if (delta === "start") return 0;
        if (delta === "end") return days - 1;
        // Entering the chart with no day selected starts at the most recent
        // end rather than the first: the newest day is what a reader arriving
        // at this chart is asking about.
        const base = current ?? days - 1;
        return Math.min(days - 1, Math.max(0, base + delta));
      });
    },
    [days],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowLeft":
          step(-1);
          break;
        case "ArrowRight":
          step(1);
          break;
        case "Home":
          step("start");
          break;
        case "End":
          step("end");
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [step],
  );

  if (days === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center text-xs",
          className,
        )}
        style={{ height }}
      >
        No window to chart
      </div>
    );
  }

  const active = activeIndex === null ? null : series[activeIndex];
  const activePrior =
    activeIndex === null || alignedPrior.length !== days
      ? undefined
      : alignedPrior[activeIndex];
  const total = series.reduce((sum, point) => sum + point.commits, 0);
  const peak = Math.max(...series.map((point) => point.commits));

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        // A group rather than `role="img"`: the wrapper owns pointer handling,
        // while the svg below is the image and the live region is the
        // announcement. Putting all three on one node would mean the svg's
        // accessible name changes as the reader moves, which re-announces the
        // entire series on every arrow key.
        role="group"
        aria-label="Commits per day. Use the left and right arrow keys to inspect individual days."
        tabIndex={0}
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onFocus={() => setActiveIndex(days - 1)}
        onPointerLeave={(event) => {
          if (document.activeElement !== event.currentTarget)
            setActiveIndex(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setActiveIndex(null)}
        className="focus-visible:ring-ring/60 relative cursor-crosshair touch-pan-y rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <svg
          width={width}
          className="block max-w-full"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${formatCount(total)} commits across ${days} days, peaking at ${formatCount(
            peak,
          )} in a day.`}
        >
          {geometry.ticks.map((tick) => (
            <line
              key={tick.value}
              x1={geometry.plot.left}
              x2={geometry.plot.right}
              y1={tick.y}
              y2={tick.y}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="2 4"
              className="text-border"
            />
          ))}

          {priorPath && (
            <path
              d={priorPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 3"
              className="text-muted-foreground"
            />
          )}

          {series.map(
            (point, index) =>
              point.commits > 0 && (
                <rect
                  key={point.date}
                  x={xFor(geometry, index, days) - barWidth / 2}
                  y={yFor(geometry, point.commits)}
                  width={barWidth}
                  height={
                    geometry.plot.baseline - yFor(geometry, point.commits)
                  }
                  rx={Math.min(3, barWidth / 3)}
                  fill="currentColor"
                  className="text-primary"
                  opacity={
                    activeIndex === null || activeIndex === index ? 0.9 : 0.45
                  }
                />
              ),
          )}

          {/* Baseline last, so it draws over the area fill's edge. */}
          <line
            x1={geometry.plot.left}
            x2={geometry.plot.right}
            y1={geometry.plot.baseline}
            y2={geometry.plot.baseline}
            stroke="currentColor"
            strokeWidth={1}
            className="text-border"
          />

          {active && activeIndex !== null && (
            <g>
              <line
                x1={xFor(geometry, activeIndex, days)}
                x2={xFor(geometry, activeIndex, days)}
                y1={geometry.plot.top}
                y2={geometry.plot.baseline}
                stroke="currentColor"
                strokeWidth={1}
                className="text-foreground/40"
              />
              {/* Drawn as a circle rather than an ellipse — which is exactly what
                  the old non-uniform scale made it, invisibly. */}
              <circle
                cx={xFor(geometry, activeIndex, days)}
                cy={yFor(geometry, active.commits)}
                r={3}
                className="text-primary fill-current"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {/* Y-axis labels, outside the svg because they are text and text must
            not inherit the plot's coordinate space. Right-aligned so the plot
            stays flush with the surrounding text on its left edge. */}
        <div
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-0 right-0 font-mono text-[9px] tabular-nums"
          style={{ height }}
        >
          {geometry.ticks
            .filter((tick) => tick.label !== null)
            .map((tick) => (
              <span
                key={tick.value}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: tick.y }}
              >
                {tick.label}
              </span>
            ))}
        </div>

        {active && activeIndex !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10"
            style={{
              left: Math.max(
                Math.min(width / 2, 125),
                Math.min(
                  width - Math.min(width / 2, 125),
                  xFor(geometry, activeIndex, days),
                ),
              ),
              maxWidth: width,
              transform: "translateX(-50%)",
            }}
          >
            <div className="border-border bg-popover text-popover-foreground max-w-full rounded-md border px-2 py-1 text-[11px] shadow-sm">
              <span className="font-semibold tabular-nums">
                {formatCount(active.commits)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                {active.commits === 1 ? "commit" : "commits"}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {formatDate(active.date)}
              </span>
              {activePrior && (
                <span className="text-muted-foreground">
                  {" · prev "}
                  {activePrior.commits}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Announced for keyboard readers; visually hidden. The chart's own
          tooltip is pointer-only, so without this the arrow keys would move a
          selection a sighted keyboard user could see but nobody else could. */}
      <span className="sr-only" aria-live="polite" role="status">
        {active
          ? `${formatDate(active.date)}: ${formatCount(active.commits)} ${
              active.commits === 1 ? "commit" : "commits"
            }${activePrior ? `, ${formatCount(activePrior.commits)} in the previous period` : ""}`
          : ""}
      </span>

      {/* X axis. A 7-day window gets weekday initials, which is what makes a
          week readable at a glance; a 90-day window gets dates, because
          "Mon" seven times is noise. */}
      <div className="text-muted-foreground mt-1.5 flex justify-between font-mono text-[10px] tabular-nums">
        {geometry.xTickIndices.map((index) => (
          <span key={index}>
            {days <= 7
              ? formatWeekday(series[index]!.date)
              : formatDate(series[index]!.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

export { ActivityChart };
export default memo(ActivityChart);
