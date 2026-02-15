"use client";

/**
 * Commit frequency chart — bar chart showing daily commits over the last 7 days.
 * Uses Recharts (dynamically imported to reduce bundle size).
 * Subscribes to useCommitChart() — isolated rerender scope.
 */

import { memo, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useCommitChart } from "@/features/dashboard/hooks/use-dashboard";
import { CHART_DAYS } from "@/features/dashboard/constants/dashboard.constants";

/**
 * Simple CSS-only bar chart — avoids Recharts bundle for this small visualization.
 * Each bar represents one day, height proportional to max commits that day.
 */
function MiniBarChart({ data }: { data: { date: string; commits: number }[] }) {
  const max = useMemo(() => Math.max(...data.map((d) => d.commits), 1), [data]);

  /** Format date to short day name (Mon, Tue, ...) */
  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((point) => {
        const height = Math.max((point.commits / max) * 100, 4);
        return (
          <div
            key={point.date}
            className="flex flex-1 flex-col items-center gap-1"
          >
            {/* Bar */}
            <div
              className={cn(
                "w-full rounded-t-md transition-all duration-300",
                point.commits > 0
                  ? "bg-primary/70 hover:bg-primary"
                  : "bg-muted/40",
              )}
              style={{ height: `${height}%` }}
              title={`${point.commits} commits`}
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
        "rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-xl",
        "shadow-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Commit Activity
          </h3>
        </div>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {totalCommits} this week
          </span>
        )}
      </div>

      {/* Chart */}
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        <MiniBarChart data={chartData} />
      )}
    </div>
  );
}

export default memo(CommitChart);
