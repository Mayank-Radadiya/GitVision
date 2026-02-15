"use client";

/**
 * Simplified project card — single file replaces the 6-file repository-card/ folder.
 * Displays project name, GitHub link, key stats, and creation date.
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  Star,
  GitFork,
  GitCommit,
  Users,
  ExternalLink,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface ProjectCardProps {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  totalCommits: number;
  totalContributors: number;
  createdAt: Date;
  index: number;
}

/** Format large numbers: 1200 → "1.2k", 1200000 → "1.2M" */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

/** Single inline stat with icon */
function Stat({
  icon: Icon,
  value,
  color,
}: {
  icon: typeof Star;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <Icon className={cn("h-3.5 w-3.5", color)} />
      <span className="font-medium text-foreground">{fmt(value)}</span>
    </div>
  );
}

function ProjectCard({
  id,
  projectName,
  githubUrl,
  star,
  forks,
  totalCommits,
  totalContributors,
  createdAt,
  index,
}: ProjectCardProps) {
  const router = useRouter();

  const repoPath = githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "");
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <div
        onClick={() => router.push(`/dashboard/user-project/${id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) =>
          e.key === "Enter" && router.push(`/dashboard/user-project/${id}`)
        }
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-2xl border p-5",
          "bg-card/80 backdrop-blur-xl",
          "border-border/60 hover:border-primary/30",
          "shadow-sm hover:shadow-md transition-all duration-200",
        )}
        aria-label={`Open project ${projectName}`}
      >
        {/* Ambient glow on hover */}
        <div
          className={cn(
            "absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl",
            "transition-opacity duration-300 group-hover:opacity-20",
            "bg-gradient-to-br from-primary to-blue-400",
          )}
        />

        <div className="relative z-10">
          {/* Row 1: Avatar + Name + Arrow */}
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                "bg-gradient-to-br from-primary/15 to-blue-400/15",
                "text-primary font-bold text-base",
                "transition-transform duration-200 group-hover:scale-105",
              )}
            >
              {projectName.charAt(0).toUpperCase()}
            </div>

            {/* Name + URL */}
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                {projectName}
              </h3>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                aria-label={`View ${repoPath} on GitHub`}
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate">{repoPath}</span>
              </a>
            </div>

            {/* Arrow */}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
          </div>

          {/* Row 2: Stats + Time */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <Stat icon={Star} value={star} color="text-amber-500" />
              <Stat icon={GitFork} value={forks} color="text-blue-500" />
              <Stat
                icon={GitCommit}
                value={totalCommits}
                color="text-emerald-500"
              />
              <Stat
                icon={Users}
                value={totalContributors}
                color="text-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
              <Clock className="h-3 w-3" />
              <span>{timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(ProjectCard);
