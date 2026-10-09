"use client";

import { memo } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, Minus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { formatCompact, formatCount, formatDelta } from "@/shared/lib/format";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ActivityChart, type ActivityPoint } from "../charts/activity-chart";

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

const TREND_STYLE: Record<
  TrendDirection,
  { className: string; Icon: typeof ArrowUpRight }
> = {
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
  /**
   * The insights aggregate errored. Distinct from an empty `series`, which means
   * a successful query over a quiet window — that still gets its "no commits
   * landed" line. A failure must not be rendered as an empty chart frame, which
   * would tell the reader the repository is quiet when in fact nothing was asked.
   */
  hasFailed?: boolean;
  showWindowControl?: boolean;
}

function ActivityPanel({
  series,
  prior,
  summary,
  days,
  onWindowChange,
  isLoading,
  isFetching,
  hasFailed,
  showWindowControl = true,
}: ActivityPanelProps) {
  const trend = summary
    ? describeTrend(summary)
    : { direction: "idle" as const, fraction: null, label: "" };
  const style = TREND_STYLE[trend.direction];

  return (
    <section
      aria-label="Commit activity"
      className="flex min-w-0 flex-col gap-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="mb-4 text-sm font-semibold tracking-tight">
            Commit activity
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-3xl font-semibold tracking-tight tabular-nums">
              {isLoading || !summary || hasFailed
                ? "—"
                : formatCompact(summary.commitsInWindow)}
            </span>
            <span className="text-muted-foreground text-xs">
              {days === 7 ? "commits this week" : `commits / ${days}d`}
            </span>
          </div>
          {/* Suppressed outright on failure rather than rendered as a dash. A lone "—"
              where a comparison used to be reads as a broken sentence, and the
              chart's own callout directly below already says what happened. A
              genuine quiet window is a different thing entirely — it keeps its
              trend line, because "no activity" is a real finding. */}
          {!hasFailed && (
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
          )}
        </div>

        <div className="flex flex-col items-end gap-4">
          {showWindowControl && (
            <ActivityWindowControl days={days} onChange={onWindowChange} />
          )}
          <div
            className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]"
            aria-hidden="true"
          >
            <span className="flex items-center gap-1.5">
              <span className="bg-primary h-2 w-2 rounded-xs" />
              Current
            </span>
            {prior?.length ? (
              <span className="flex items-center gap-1.5">
                <span className="border-muted-foreground w-3 border-t border-dashed" />
                Previous
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative">
        {isFetching && !isLoading && (
          <Loader2
            className="text-muted-foreground absolute top-1 right-1 z-10 size-3 animate-spin"
            aria-label="Updating"
          />
        )}
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : hasFailed ? (
          <p
            role="status"
            className="text-muted-foreground bg-muted/30 rounded-md px-3 py-6 text-center text-xs"
          >
            Commit activity couldn’t be loaded. The rest of this project is
            unaffected.
          </p>
        ) : (
          <ActivityChart
            height={240}
            series={series}
            prior={prior}
            // Dimmed rather than removed: the shape of the previous period is the
            // context for the trend number directly above it, so hiding it on
            // refetch would make the two disagree mid-interaction.
            className={cn(
              isFetching && !isLoading && "opacity-60 transition-opacity",
            )}
          />
        )}
      </div>

      {/* Only for a *successful* empty window. Gated on `!hasFailed` so a
          failure can never be misreported as a repository that went quiet. */}
      {!hasFailed &&
        series.length > 0 &&
        series.every((point) => point.commits === 0) && (
          <p className="text-muted-foreground -mt-1 text-xs">
            No commits landed in this {days}-day window.
          </p>
        )}

      {!isLoading && !hasFailed && summary && (
        <dl className="border-border grid grid-cols-3 gap-3 border-t pt-4">
          <div>
            <dt className="text-muted-foreground text-[11px]">Active days</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {summary.activeDays}
              <span className="text-muted-foreground font-normal">
                {" "}
                / {days}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px]">Daily average</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {(summary.commitsInWindow / days).toFixed(1)}
              <span className="text-muted-foreground font-normal">
                {" "}
                commits
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-[11px]">
              Previous {days} days
            </dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {formatCount(summary.priorWindowCommits)}
              <span className="text-muted-foreground font-normal">
                {" "}
                commits
              </span>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export { ActivityPanel };
export default memo(ActivityPanel);
export function ActivityWindowControl({
  days,
  onChange,
  disabled,
}: {
  days: ActivityWindow;
  onChange: (days: ActivityWindow) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Activity window"
      className="border-border bg-muted/40 flex rounded-md border p-0.5"
    >
      {ACTIVITY_WINDOWS.map((value) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          aria-pressed={days === value}
          onClick={() => onChange(value)}
          className={cn(
            "relative rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            days === value
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="relative">{value}d</span>
        </button>
      ))}
    </div>
  );
}
