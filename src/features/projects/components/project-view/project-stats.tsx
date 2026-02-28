"use client";

/**
 * Project Stats — Compact horizontal pill row of repo metrics.
 * Stars & Forks are displayed in the header; remaining 4 stats shown here.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { GitBranch, Users, GitCommit, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface ProjectStatsProps {
  project:
    | {
        totalBranches: number;
        totalContributors: number;
        totalCommits: number;
        createdAt: Date;
      }
    | undefined;
  isLoading: boolean;
}

const STAT_ITEMS = [
  {
    key: "branches",
    label: "Branches",
    icon: GitBranch,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    getValue: (p: ProjectStatsProps["project"]) => p?.totalBranches ?? 0,
    format: (v: string | number) =>
      typeof v === "number" ? v.toLocaleString() : v,
  },
  {
    key: "contributors",
    label: "Contributors",
    icon: Users,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    getValue: (p: ProjectStatsProps["project"]) => p?.totalContributors ?? 0,
    format: (v: string | number) =>
      typeof v === "number" ? v.toLocaleString() : v,
  },
  {
    key: "commits",
    label: "Total Commits",
    icon: GitCommit,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    getValue: (p: ProjectStatsProps["project"]) => p?.totalCommits ?? 0,
    format: (v: string | number) =>
      typeof v === "number" ? v.toLocaleString() : v,
  },
  {
    key: "created",
    label: "Created",
    icon: Calendar,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    getValue: (p: ProjectStatsProps["project"]) =>
      p?.createdAt ? format(new Date(p.createdAt), "MMM d, yyyy") : "—",
    format: (v: string | number) => v,
  },
] as const;

function ProjectStats({ project, isLoading }: ProjectStatsProps) {
  if (isLoading) {
    return (
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-36 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1, staggerChildren: 0.05 }}
      className="flex gap-3 flex-wrap"
    >
      {STAT_ITEMS.map((stat, i) => {
        const Icon = stat.icon;
        const raw = stat.getValue(project);
        const displayValue = stat.format(raw);

        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
            className="inline-flex items-center gap-2.5 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-2 hover:border-border/70 hover:bg-card/80 transition-all duration-200 cursor-default"
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-md ${stat.bg}`}
            >
              <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-foreground tabular-nums leading-none">
                {displayValue}
              </span>
              <span className="text-[11px] text-muted-foreground leading-none">
                {stat.label}
              </span>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default memo(ProjectStats);
