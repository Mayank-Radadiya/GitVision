"use client";

/**
 * Activity panel — the trend, its direction, and the window it describes.
 *
 * The trend figure is the whole reason this exists. "412 commits" says a project
 * is large; "+18% vs the previous 30 days" says whether it is *moving*, which is
 * the question a person opening a project dashboard actually has.
 *
 * The delta is computed from the prior window the server returns alongside the
 * current one. Two rules keep it honest, both learned from the chart it replaces:
 *
 *   1. A prior period of zero has no percentage. `+∞%` is not a number, so a
 *      project that went from nothing to something reads as "new activity" rather
 *      than an unwitnessable growth rate.
 *   2. A window with no activity at all is not a "−100% decline" in a chart — it
 *      is an empty chart, and the panel says so instead of drawing a flat line.
 */

import { memo } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, Minus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { formatCompact, formatCount, formatDelta } from "@/shared/lib/format";
import { ActivityAreaChart, type ActivityPoint } from "../charts/activity-area-chart";

export const ACTIVITY_WINDOWS = [7, 30, 90] as const;
export type ActivityWindow = (typeof ACTIVITY_WINDOWS)[number];

export interface ActivitySummary {
  commitsInWindow: number;
  priorWindowCommits: number;
  activeDays: number;
}

/**
 * The direction of the trend, as a value rather than a rendered icon.
 *
 * `new` is its own case because it is not a magnitude: activity where there was
 * none cannot be expressed as a ratio, so the UI must not try.
 */
export type TrendDirection = "up" | "down" | "flat" | "new" | "idle";

export function describeTrend(summary: ActivitySummary): {
  direction: TrendDirection;
  /** Percentage change, or `null` when there is no meaningful ratio. */
  fraction: number | null;
  label: string;
} {
  const { commitsInWindow, priorWindowCommits } = summary;
  if (commitsInWindow === 0 && priorWindowCommits === 0) {
    return { direction: "idle", fraction: null, label: "No activity" };
  }
  if (priorWindowCommits === 0) {
    return { direction: "new", fraction: null, label: "New activity" };
  }
  const fraction = (commitsInWindow - priorWindowCommits) / priorWindowCommits;
  const rounded = Math.round(fraction * 100);
  if (rounded === 0) {
    return { direction: "flat", fraction: 0, label: "Unchanged" };
  }
  return {
    direction: rounded > 0 ? "up" : "down",
    fraction,
    label: `${formatDelta(fraction)} vs previous`,
  };
}

const TREND_STYLE: Record<TrendDirection, { className: string; Icon: typeof ArrowUpRight }> =
  {
    up: { className: "text-gv-moss", Icon: ArrowUpRight },
    down: { className: "text-gv-ember", Icon: ArrowDownRight },
    flat: { className: "text-muted-foreground", Icon: Minus },
    new: { className: "text-gv-wire", Icon: ArrowUpRight },
    idle: { className: "text-muted-foreground", Icon: Minus },
  };

interface ActivityPanelProps {
  series: ActivityPoint[];
  prior?: ActivityPoint[];
  summary?: ActivitySummary;
  days: ActivityWindow;
  onWindowChange: (days: ActivityWindow) => void;
  isLoading?: boolean;
  isFetching?: boolean;
}

function ActivityPanel({
  series,
  prior,
  summary,
  days,
  onWindowChange,
  isLoading,
  isFetching,
}: ActivityPanelProps) {
  const trend = summary
    ? describeTrend(summary)
    : { direction: "idle" as const, fraction: null, label: "" };
  const style = TREND_STYLE[trend.direction];

  return (
    <section aria-label="Commit activity" className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
              {isLoading || !summary
                ? "—"
                : formatCompact(summary.commitsInWindow)}
            </span>
            <span className="text-muted-foreground text-xs">
              {days === 7 ? "commits this week" : `commits / ${days}d`}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1 text-xs font-medium",
              style.className,
            )}
          >
            <style.Icon className="size-3" aria-hidden="true" />
            {trend.label}
            {summary && summary.commitsInWindow > 0 && (
              <span className="text-muted-foreground font-normal">
                {" · "}
                {summary.activeDays} active{" "}
                {summary.activeDays === 1 ? "day" : "days"}
              </span>
            )}
          </p>
        </div>

        <div
          role="group"
          aria-label="Activity window"
          className="border-border bg-muted/40 flex shrink-0 gap-0.5 rounded-md border p-0.5"
        >
          {ACTIVITY_WINDOWS.map((window) => (
            <button
              key={window}
              type="button"
              onClick={() => onWindowChange(window)}
              aria-pressed={days === window}
              className={cn(
                "focus-visible:ring-ring rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                days === window
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {window}d
            </button>
          ))}
        </div>
      </header>

      <div className="relative">
        {isFetching && !isLoading && (
          <Loader2
            className="text-muted-foreground absolute top-1 right-1 z-10 size-3 animate-spin"
            aria-label="Updating"
          />
        )}
        <ActivityAreaChart
          series={series}
          prior={prior}
          // Dimmed rather than removed: the shape of the previous period is the
          // context for the trend number directly above it, so hiding it on
          // refetch would make the two disagree mid-interaction.
          className={cn(isFetching && !isLoading && "opacity-60 transition-opacity")}
        />
      </div>

      {series.length > 0 && series.every((point) => point.commits === 0) && (
        <p className="text-muted-foreground -mt-1 text-xs">
          No commits landed in this {days}-day window.
        </p>
      )}

      {prior && prior.length > 0 && (
        <p className="text-muted-foreground text-[11px]">
          Dashed line: the {days} days before this window
          {" · "}
          {formatCount(
            prior.reduce((sum, point) => sum + point.commits, 0),
          )}{" "}
          commits.
        </p>
      )}
    </section>
  );
}

export { ActivityPanel };
export default memo(ActivityPanel);