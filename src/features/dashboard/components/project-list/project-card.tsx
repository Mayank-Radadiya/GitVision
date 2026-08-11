"use client";

import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  GitCommit,
  GitFork,
  Star,
  Users,
  ChevronRight,
  ExternalLink,
  type LucideIcon,
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

/** Compact inline stat */
function InlineStat({
  icon: Icon,
  value,
  colorClass = "text-muted-foreground",
}: {
  icon: LucideIcon;
  value: number;
  colorClass?: string;
}) {
  return (
    <span className="text-muted-foreground group-hover:text-foreground flex items-center gap-1.5 transition-colors">
      <Icon className={cn("h-3.5 w-3.5", colorClass)} />
      <span className="text-[13px] font-medium tabular-nums">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </span>
    </span>
  );
}

// Generate consistent background color based on name
function getProjectColor(name: string) {
  const colors = [
    "bg-blue-500/10 text-blue-500",
    "bg-emerald-500/10 text-emerald-500",
    "bg-amber-500/10 text-amber-500",
    "bg-cyan-500/10 text-cyan-500",
    "bg-rose-500/10 text-rose-500",
    "bg-purple-500/10 text-purple-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function ProjectCard({
  id,
  projectName,
  githubUrl,
  star,
  forks,
  totalCommits,
  totalContributors,
}: ProjectCardProps) {
  const router = useRouter();

  const repoPath = useMemo(() => {
    try {
      const url = new URL(githubUrl);
      return url.pathname.slice(1);
    } catch {
      return githubUrl;
    }
  }, [githubUrl]);

  return (
    <div
      onClick={() => router.push(`/dashboard/user-project/${id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) =>
        e.key === "Enter" && router.push(`/dashboard/user-project/${id}`)
      }
      className={cn(
        "group border-border/50 relative cursor-pointer rounded-2xl border p-4",
        "bg-card/40 backdrop-blur-xl",
        "shadow-sm transition-all duration-300",
        "hover:bg-card/80 hover:border-primary/40 hover:shadow-primary/5 hover:-translate-y-0.5 hover:shadow-md",
      )}
      aria-label={`Open project ${projectName}`}
    >
      <div className="flex items-center gap-4">
        {/* Project icon */}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm transition-transform duration-300 group-hover:scale-105",
            getProjectColor(projectName),
          )}
        >
          {projectName.charAt(0).toUpperCase()}
        </div>

        {/* Name + URL */}
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground group-hover:text-primary truncate text-base font-semibold tracking-tight transition-colors">
            {projectName}
          </h3>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground/60 hover:text-primary mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            aria-label={`View ${repoPath} on GitHub`}
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{repoPath}</span>
          </a>
        </div>

        {/* Stats */}
        <div className="hidden items-center gap-5 sm:flex">
          <InlineStat icon={Star} value={star} colorClass="text-amber-400" />
          <InlineStat icon={GitFork} value={forks} colorClass="text-blue-400" />
          <InlineStat
            icon={GitCommit}
            value={totalCommits}
            colorClass="text-emerald-400"
          />
          <InlineStat
            icon={Users}
            value={totalContributors}
            colorClass="text-purple-400"
          />
        </div>

        {/* Arrow */}
        <div className="bg-border/50 -ml-2 flex h-7 w-7 items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:opacity-100">
          <ChevronRight className="text-foreground/80 h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default memo(ProjectCard);
