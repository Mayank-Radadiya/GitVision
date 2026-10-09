"use client";

import { memo } from "react";
import {
  ArrowUpRight,
  Files,
  GitCommitHorizontal,
  GitPullRequest,
  CircleDot,
} from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatCount } from "@/shared/lib/format";
import type { ProjectTab } from "@/features/projects/types/project.types";
import type { WorkSummary } from "./work-items";
import { describeTrend } from "./activity-panel";

export interface MetricStripData {
  totalCommits?: number | null;
  commitsInWindow?: number | null;
  priorWindowCommits?: number | null;
  days?: number;
  totalFiles?: number | null;
  indexedFiles?: number | null;
  work?: WorkSummary;
}
interface MetricStripProps {
  data: MetricStripData;
  isLoading?: boolean;
  onNavigate?: (tab: ProjectTab) => void;
}

function MetricStrip({ data, isLoading, onNavigate }: MetricStripProps) {
  const trend =
    data.commitsInWindow != null && data.priorWindowCommits != null
      ? describeTrend({
          commitsInWindow: data.commitsInWindow,
          priorWindowCommits: data.priorWindowCommits,
          activeDays: 0,
        }).label
      : "Period comparison unavailable";
  const tiles = [
    {
      label: "Commits",
      value: data.commitsInWindow,
      detail: `${data.days ?? 30} days · ${trend}`,
      icon: GitCommitHorizontal,
      target: "commits" as const,
      loading: isLoading,
    },
    {
      label: "Open pull requests",
      value: data.work?.openPullRequests,
      detail: data.work
        ? `${formatCount(data.work.mergedPullRequests)} closed · all time`
        : "Work data unavailable",
      icon: GitPullRequest,
      target: "pull-requests" as const,
      loading: isLoading,
    },
    {
      label: "Open issues",
      value: data.work?.openIssues,
      detail: data.work
        ? `${formatCount(data.work.closedIssues)} closed · all time`
        : "Work data unavailable",
      icon: CircleDot,
      target: "issues" as const,
      loading: isLoading,
    },
    {
      label: "Searchable files",
      value: data.indexedFiles,
      detail:
        data.totalFiles == null
          ? "Coverage unavailable"
          : `of ${formatCount(data.totalFiles)} repository files`,
      icon: Files,
      target: "files" as const,
      loading: false,
    },
  ];
  return (
    <div
      aria-label="Project metrics"
      className="project-metrics grid min-w-0 grid-cols-2 gap-3"
    >
      {tiles.map(({ label, value, detail, icon: Icon, target, loading }) => {
        const body = (
          <>
            <span className="text-muted-foreground flex items-center justify-between gap-2 text-xs font-medium">
              <span className="flex items-center gap-2">
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {label}
              </span>
              <ArrowUpRight
                className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden="true"
              />
            </span>
            {loading ? (
              <>
                <Skeleton className="mt-4 h-8 w-16" />
                <Skeleton className="mt-3 h-3 w-3/4" />
              </>
            ) : (
              <>
                <span className="mt-4 block text-[30px] leading-none font-semibold tracking-tight tabular-nums">
                  {value == null ? "—" : formatCount(value)}
                </span>
                <span className="text-muted-foreground mt-3 block text-xs leading-relaxed">
                  {detail}
                </span>
              </>
            )}
          </>
        );
        const classes =
          "group min-w-0 rounded-xl border border-border bg-card px-4 py-5 text-left sm:px-5";
        return onNavigate ? (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate(target)}
            className={`${classes} hover:border-primary/35 hover:bg-accent/40 transition-colors`}
            aria-label={`${label}: ${value == null ? "unavailable" : formatCount(value)}. View ${target}.`}
          >
            {body}
          </button>
        ) : (
          <div key={label} className={classes}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
export { MetricStrip };
export default memo(MetricStrip);
