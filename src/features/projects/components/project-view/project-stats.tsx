"use client";

/**
 * Project Stats — Bento grid of repository metrics.
 * Config-driven: stat cards defined in array, not hardcoded JSX.
 * Reuses color tokens from dashboard constants.
 */

import { memo } from "react";
import {
  Star,
  GitFork,
  GitBranch,
  Users,
  GitCommit,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface ProjectStatsProps {
  project:
    | {
        star: number;
        forks: number;
        totalBranches: number;
        totalContributors: number;
        totalCommits: number;
        createdAt: Date;
      }
    | undefined;
  isLoading: boolean;
}

/** Stat card configuration — drives the grid */
const STAT_ITEMS = [
  {
    key: "stars",
    label: "Stars",
    icon: Star,
    color: "text-amber-400",
    getValue: (p: ProjectStatsProps["project"]) => p?.star ?? 0,
  },
  {
    key: "forks",
    label: "Forks",
    icon: GitFork,
    color: "text-blue-400",
    getValue: (p: ProjectStatsProps["project"]) => p?.forks ?? 0,
  },
  {
    key: "branches",
    label: "Branches",
    icon: GitBranch,
    color: "text-emerald-400",
    getValue: (p: ProjectStatsProps["project"]) => p?.totalBranches ?? 0,
  },
  {
    key: "contributors",
    label: "Contributors",
    icon: Users,
    color: "text-orange-400",
    getValue: (p: ProjectStatsProps["project"]) => p?.totalContributors ?? 0,
  },
  {
    key: "commits",
    label: "Total Commits",
    icon: GitCommit,
    color: "text-sky-400",
    getValue: (p: ProjectStatsProps["project"]) => p?.totalCommits ?? 0,
  },
  {
    key: "created",
    label: "Created",
    icon: Calendar,
    color: "text-violet-400",
    getValue: (p: ProjectStatsProps["project"]) =>
      p?.createdAt ? format(new Date(p.createdAt), "MMM d, yyyy") : "N/A",
  },
] as const;

function ProjectStats({ project, isLoading }: ProjectStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {STAT_ITEMS.map((stat) => {
        const Icon = stat.icon;
        const value = stat.getValue(project);

        return (
          <div
            key={stat.key}
            className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/80 backdrop-blur-xl p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-md cursor-default"
          >
            {/* Hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative space-y-2.5">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(ProjectStats);
