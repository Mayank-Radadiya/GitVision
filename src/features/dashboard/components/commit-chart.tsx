"use client";

/**
 * Commit frequency chart — bar chart showing daily commits over the last 7 days.
 * CSS-only bars with hover tooltips. Shows empty state when no commits.
 */

import { memo, useMemo } from "react";
import { BarChart3, GitCommitHorizontal } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useCommitChart } from "@/features/dashboard/hooks/use-dashboard";
import { CHART_DAYS } from "@/features/dashboard/constants/dashboard.constants";

/**
 * CSS-only bar chart with hover effects.
 */
function MiniBarChart({ data }: { data: { date: string; commits: number }[] }) {
  const max = useMemo(() => Math.max(...data.map((d) => d.commits), 1), [data]);
  const hasAnyCommits = data.some((d) => d.commits > 0);

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  if (!hasAnyCommits) {
    return (
      <div className="flex flex-col items-center justify-center py-6 h-20 gap-2">
        <GitCommitHorizontal className="h-8 w-8 text-muted-foreground/20" />
        <p className="text-xs text-muted-foreground/40">No commits this week</p>
        <div className="flex items-end gap-2 h-8 mt-2 w-full max-w-[200px]">
          {data.map((point) => (
            <div
              key={point.date}
              className="flex-1 rounded-sm bg-muted/15 h-2"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((point) => {
        const height = Math.max((point.commits / max) * 100, 6);
        return (
          <div
            key={point.date}
            className="flex flex-1 flex-col items-center gap-1.5 group"
          >
            {/* Commit count tooltip */}
            <span className="text-[8px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
              {point.commits}
            </span>
            {/* Bar */}
            <div
              className={cn(
                "w-full rounded-md transition-all duration-300",
                point.commits > 0
                  ? "bg-primary/50 group-hover:bg-primary"
                  : "bg-muted/20",
              )}
              style={{ height: `${height}%` }}
            />
            {/* Day label */}
            <span className="text-[10px] text-muted-foreground/60">
              {formatDay(point.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Fill missing days with zero commits */
function fillMissingDays(
  data: { date: string; commits: number }[],
  days: number,
): { date: string; commits: number }[] {
  const filled: { date: string; commits: number }[] = [];
  const dataMap = new Map(data.map((d) => [d.date, d.commits]));

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0]!;
    filled.push({ date: key, commits: dataMap.get(key) ?? 0 });
  }

  return filled;
}

function CommitChart() {
  const { data: rawData, isLoading } = useCommitChart();

  const chartData = useMemo(
    () => fillMissingDays(rawData ?? [], CHART_DAYS),
    [rawData],
  );

  const totalCommits = useMemo(
    () => chartData.reduce((sum, d) => sum + d.commits, 0),
    [chartData],
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/80 p-5 backdrop-blur-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">
            Commit Activity
          </h3>
        </div>
        {!isLoading && totalCommits > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            {totalCommits} this week
          </span>
        )}
      </div>

      {/* Chart */}
      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-lg" />
      ) : (
        <MiniBarChart data={chartData} />
      )}
    </div>
  );
}

export default memo(CommitChart);
