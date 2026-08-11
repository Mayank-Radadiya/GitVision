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
      <div className="flex h-20 flex-col items-center justify-center gap-2 py-6">
        <GitCommitHorizontal className="text-muted-foreground/20 h-8 w-8" />
        <p className="text-muted-foreground/40 text-xs">No commits this week</p>
        <div className="mt-2 flex h-8 w-full max-w-50 items-end gap-2">
          {data.map((point) => (
            <div
              key={point.date}
              className="bg-muted/15 h-2 flex-1 rounded-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-28 items-end gap-2">
      {data.map((point) => {
        const height = Math.max((point.commits / max) * 100, 6);
        return (
          <div
            key={point.date}
            className="group flex flex-1 flex-col items-center gap-1.5"
          >
            {/* Commit count tooltip */}
            <span className="text-muted-foreground text-[8px] font-medium tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
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
            <span className="text-muted-foreground/60 text-[10px]">
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
        "border-border/50 bg-card/80 rounded-xl border p-5 backdrop-blur-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-primary h-4 w-4" />
          <h3 className="text-foreground text-sm font-medium">
            Commit Activity
          </h3>
        </div>
        {!isLoading && totalCommits > 0 && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
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
