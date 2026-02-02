/**
 * =============================================================================
 * REPOSITORY CARD STATS
 * =============================================================================
 *
 * Stats row displaying stars, forks, commits, and contributors.
 */

"use client";

import { Star, GitFork, GitCommit, Users } from "lucide-react";
import { STAT_CONFIG } from "../repository-card.constants";
import { formatNumber } from "../repository-card.utils";
import { cn } from "@/shared/lib/utils";

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  bgClass: string;
}

function StatItem({ icon, value, label, bgClass }: StatItemProps) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md",
          bgClass,
        )}
      >
        {icon}
      </div>
      <span className="font-medium text-foreground">{formatNumber(value)}</span>
      <span className="text-muted-foreground text-xs hidden sm:inline">
        {label}
      </span>
    </div>
  );
}

interface RepositoryCardStatsProps {
  star: number;
  forks: number;
  totalCommits: number;
  totalContributors: number;
}

export function RepositoryCardStats({
  star,
  forks,
  totalCommits,
  totalContributors,
}: RepositoryCardStatsProps) {
  return (
    <div className="mt-5 flex items-center gap-6">
      <StatItem
        icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
        value={star}
        label={STAT_CONFIG.stars.label}
        bgClass={STAT_CONFIG.stars.bgClass}
      />
      <StatItem
        icon={<GitFork className="h-3.5 w-3.5 text-blue-500" />}
        value={forks}
        label={STAT_CONFIG.forks.label}
        bgClass={STAT_CONFIG.forks.bgClass}
      />
      <StatItem
        icon={<GitCommit className="h-3.5 w-3.5 text-emerald-500" />}
        value={totalCommits}
        label={STAT_CONFIG.commits.label}
        bgClass={STAT_CONFIG.commits.bgClass}
      />
      <StatItem
        icon={<Users className="h-3.5 w-3.5 text-violet-500" />}
        value={totalContributors}
        label={STAT_CONFIG.contributors.label}
        bgClass={STAT_CONFIG.contributors.bgClass}
      />
    </div>
  );
}
