"use client";

/**
 * ActivityAreaChart — commits per day for one project, with a prior-period
 * ghost line.
 *
 * This replaces `project-pulse-widget.tsx`'s `FrequencyChart`, which bucketed
 * the ten rows `useProjectCommits` returns into seven days and labelled the
 * result "Last 7 days". Past ten commits that chart could not be correct, and
 * nothing about it disclosed the limit.
 *
 * ── Why the SVG scales rather than measures ──────────────────────────────────
 * The plot is a fixed-height viewBox stretched to the container width
 * (`preserveAspectRatio="none"`). That is normally how you distort a chart and
 * make the strokes lie, so every stroke here carries
 * `vectorEffect="non-scaling-stroke"`, which keeps it at true device width
 * regardless of the transform. Text is not drawn in the SVG at all: axis
 * labels and the tooltip are HTML siblings, because text under a non-uniform
 * scale is genuinely unreadable and there is no vector-effect fix for it.
 *
 * The alternative was a `ResizeObserver` to render at real pixel dimensions.
 * That is more code and one more thing to polyfill in tests, in exchange for
 * precision the stroke fix already delivers.
 */

import { memo, useCallback, useRef, useState } from "react";
import { formatCount, formatDate, formatWeekday } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

export interface ActivityPoint {
  date: string;
  commits: number;
}

interface ActivityAreaChartProps {
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

const VIEW_WIDTH = 300;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Catmull-Rom → cubic Bézier, so a sparse week reads as a curve not a zigzag. */
function smoothPath(points: { x: number; y: number }[]): string {
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

function ActivityAreaChart({
  series,
  prior,
  className,
  height = 132,
}: ActivityAreaChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const count = series.length;

  const max = Math.max(
    ...series.map((point) => point.commits),
    ...(prior ?? []).map((point) => point.commits),
    1,
  );
  const hasCommits = series.some((point) => point.commits > 0);

  // Round the axis top to something a person would choose, so gridlines land on
  // 5/10/25 rather than on whatever the busiest day happened to be.
  const axisMax = axisMaxFor(max);

  const toX = useCallback(
    (index: number) =>
      count > 1 ? (index / (count - 1)) * VIEW_WIDTH : VIEW_WIDTH / 2,
    [count],
  );
  const toY = useCallback(
    (value: number) => height - (value / axisMax) * (height - 8) - 4,
    [axisMax, height],
  );

  const linePoints = series.map((point, index) => ({
    x: toX(index),
    y: toY(point.commits),
  }));
  const linePath = smoothPath(linePoints);
  const areaPath =
    count > 0
      ? `${linePath} L${toX(count - 1)},${height} L${toX(0)},${height} Z`
      : "";
  const priorPath =
    prior && prior.length > count
      ? smoothPath(
          prior
            .slice(prior.length - count)
            .map((point, index) => ({ x: toX(index), y: toY(point.commits) })),
        )
      : "";

  const handleMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || count === 0) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const fraction = (event.clientX - rect.left) / rect.width;
      setHoverIndex(clamp(Math.round(fraction * (count - 1)), 0, count - 1));
    },
    [count],
  );

  // Three gridlines, evenly spaced, labelled only at the top and the baseline.
  // Label density is a real constraint at 90 days: a label per day is noise.
  const gridlines = [0.5, 1].map((ratio) => toY(axisMax * ratio));

  const hovered = hoverIndex === null ? null : series[hoverIndex];
  const hoveredPrior =
    hoverIndex === null || !prior || prior.length < count
      ? undefined
      : prior[prior.length - count + hoverIndex];

  if (count === 0) {
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

  return (
    <div className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Commits per day: ${series
          .reduce((sum, point) => sum + point.commits, 0)
          .toLocaleString()} commits across ${count} days, peaking at ${Math.max(
          ...series.map((point) => point.commits),
        )} in a day.`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
        className="touch-none"
      >
        {gridlines.map((y) => (
          <line
            key={y}
            x1={0}
            x2={VIEW_WIDTH}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="2 4"
            className="text-border"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {priorPath && (
          <path
            d={priorPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 3"
            className="text-muted-foreground/50"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {hasCommits && (
          <>
            <path d={areaPath} fill="currentColor" className="text-primary" opacity={0.1} />
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              className="text-primary"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {hoverIndex !== null && (
          <line
            x1={toX(hoverIndex)}
            x2={toX(hoverIndex)}
            y1={0}
            y2={height}
            stroke="currentColor"
            strokeWidth={1}
            className="text-foreground/40"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Hover markers and tooltip live in HTML rather than the SVG: the plot is
          scaled non-uniformly, so an SVG circle would be an ellipse and SVG text
          would be stretched. Position is a fraction of the container width, which
          is the one thing the scaling leaves untouched. */}
      {hovered && (
        <div
          className="pointer-events-none absolute top-0"
          style={{
            left: `${count > 1 ? (hoverIndex! / (count - 1)) * 100 : 0}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex flex-col items-center">
            <div
              className="border-border bg-popover text-popover-foreground min-w-max -translate-y-1.5 rounded-md border px-2 py-1 text-[11px] shadow-sm"
              role="status"
            >
              <span className="font-semibold tabular-nums">
                {formatCount(hovered.commits)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                {hovered.commits === 1 ? "commit" : "commits"}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {formatDate(hovered.date)}
              </span>
              {hoveredPrior && (
                <span className="text-muted-foreground">
                  {" · prev "}
                  {hoveredPrior.commits}
                </span>
              )}
            </div>
            <div
              className="bg-primary ring-background size-2 -translate-y-3/4 rounded-full ring-2"
              style={{ marginTop: -(height - toY(hovered.commits)) }}
            />
          </div>
        </div>
      )}

      <div className="text-muted-foreground mt-1.5 flex justify-between font-mono text-[10px] tabular-nums">
        <span>{formatDate(series[0]!.date)}</span>
        <span>{formatWeekday(series[0]!.date)}</span>
        <span>{formatWeekday(series[count - 1]!.date)}</span>
        <span>{formatDate(series[count - 1]!.date)}</span>
      </div>
    </div>
  );
}

/** Rounds an axis top up to a readable step: 1, 2, 5, 10, 25, 50, … */
export function axisMaxFor(raw: number): number {
  if (raw <= 5) return Math.max(raw, 5);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export { ActivityAreaChart };
export default memo(ActivityAreaChart);