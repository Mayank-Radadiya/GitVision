"use client";

/**
 * Pull Requests Tab — Premium design matching the new Issues Tab style.
 */

import { memo, useMemo, useState } from "react";
import {
  GitPullRequest,
  GitPullRequestClosed,
  Sparkles,
  Search,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/components/ui/avatar";
import {
  useProjectIssues,
  useSyncIssues,
} from "@/features/projects/hooks/use-project";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    className: string;
    glow: string;
    Icon: React.ElementType;
    color: string;
  }
> = {
  open: {
    label: "Open",
    className: "bg-emerald-500/8 text-emerald-400 border-emerald-500/20",
    glow: "bg-emerald-400/20",
    Icon: GitPullRequest,
    color: "text-emerald-400",
  },
  merged: {
    label: "Merged",
    className: "bg-violet-500/8 text-violet-400 border-violet-500/20",
    glow: "bg-violet-400/20",
    Icon: GitPullRequestClosed,
    color: "text-violet-400",
  },
  closed: {
    label: "Closed",
    className: "bg-rose-500/8 text-rose-400 border-rose-500/20",
    glow: "bg-rose-400/20",
    Icon: GitPullRequestClosed,
    color: "text-rose-400",
  },
};

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const FILTERS = ["All", "Open", "Closed"] as const;
type FilterType = (typeof FILTERS)[number];

// ─── Main Component ───────────────────────────────────────────────────────────

interface PullRequestsTabProps {
  projectId: string;
  repoUrl?: string;
}

function PullRequestsTab({ projectId, repoUrl }: PullRequestsTabProps) {
  const { data: prs = [], isLoading } = useProjectIssues(projectId, true);
  const { mutate: syncIssues, isPending: isSyncing } = useSyncIssues(projectId);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPRs = useMemo(() => {
    return prs.filter((pr) => {
      // 1. Text Search Filter
      const matchesSearch = pr.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      // 2. Status Filter
      if (activeFilter === "Open" && pr.state !== "open") return false;
      if (activeFilter === "Closed" && pr.state !== "closed") return false;

      return matchesSearch;
    });
  }, [prs, activeFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search + Filter Row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="group/search relative flex-1">
          <Search className="text-muted-foreground/40 group-focus-within/search:text-primary/50 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 transition-colors" />
          <input
            type="text"
            placeholder="Search pull requests…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border/40 bg-card/60 text-foreground placeholder:text-muted-foreground/45 focus:ring-primary/25 focus:border-primary/30 w-full rounded-xl border py-2.5 pr-4 pl-9 text-sm backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none"
          />
        </div>
        <div className="border-border/40 bg-card/60 flex shrink-0 items-center gap-0.5 rounded-xl border p-1 backdrop-blur-sm">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "relative cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                activeFilter === f
                  ? "text-primary"
                  : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              {activeFilter === f && (
                <motion.div
                  layoutId="pr-filter-pill"
                  className="bg-primary/10 border-primary/15 absolute inset-0 rounded-lg border"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{f}</span>
            </button>
          ))}
        </div>
      </div>

      {/* PR List */}
      <div className="border-border/40 divide-border/25 bg-card/50 divide-y overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="relative">
              <div className="border-primary/10 h-8 w-8 rounded-full border-2" />
              <Loader2 className="text-primary/40 absolute inset-0 h-8 w-8 animate-spin" />
            </div>
            <span className="text-muted-foreground/40 text-xs font-medium">
              Loading pull requests…
            </span>
          </div>
        ) : filteredPRs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="bg-muted/20 flex h-10 w-10 items-center justify-center rounded-full">
              <GitPullRequest className="text-muted-foreground/25 h-4 w-4" />
            </div>
            <p className="text-muted-foreground/40 text-sm font-medium">
              No pull requests found
            </p>
            {prs.length === 0 && !searchQuery ? (
              <button
                onClick={() => syncIssues({ projectId })}
                disabled={isSyncing}
                className="border-border/40 bg-card/60 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
                {isSyncing ? "Syncing from GitHub…" : "Sync PRs from GitHub"}
              </button>
            ) : (
              <p className="text-muted-foreground/25 text-xs">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        ) : (
          filteredPRs.map((pr) => {
            const statusConfig =
              STATUS_CONFIG[pr.state] || STATUS_CONFIG.closed;
            const StatusIcon = statusConfig.Icon;

            const githubUrl = repoUrl
              ? `${repoUrl.replace(/\.git$/, "")}/pull/${pr.issueNumber}`
              : null;

            return (
              <div
                key={pr.id}
                className="hover:bg-muted/15 group relative cursor-default px-5 py-4 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon with subtle glow */}
                  <div className="relative mt-0.5 shrink-0">
                    <div
                      className={`absolute inset-0 rounded-full blur-[6px] ${statusConfig.glow}`}
                    />
                    <StatusIcon
                      className={`relative h-4 w-4 ${statusConfig.color}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-foreground/90 group-hover:text-foreground line-clamp-1 text-sm leading-snug font-medium transition-colors duration-200">
                        {pr.title}
                      </p>

                      {/* Actions */}
                      <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                        {githubUrl && (
                          <a
                            href={githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:bg-muted/30 group/link cursor-pointer rounded-lg p-1.5 transition-all"
                            title="View on GitHub"
                          >
                            <ExternalLink className="text-muted-foreground/50 group-hover/link:text-foreground h-3.5 w-3.5 transition-all group-hover/link:scale-105" />
                          </a>
                        )}
                        <Badge
                          variant="outline"
                          className={`h-5 shrink-0 border px-2 text-[10px] font-medium ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="text-muted-foreground/60 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground/40 font-mono">
                        #{pr.issueNumber}
                      </span>
                      <span className="text-muted-foreground/35">•</span>
                      <span>
                        {pr.state === "open" ? "opened" : "updated"}{" "}
                        {formatDistanceToNow(
                          new Date(
                            pr.githubUpdatedAt ||
                              pr.githubCreatedAt ||
                              Date.now(),
                          ),
                          { addSuffix: true },
                        )}
                      </span>
                      <span className="text-muted-foreground/35">•</span>
                      <div className="text-muted-foreground/70 flex items-center gap-1.5 font-medium">
                        <Avatar className="ring-border/30 h-4 w-4 ring-1">
                          <AvatarImage src={pr.authorAvatar || ""} />
                          <AvatarFallback className="text-[7px] font-bold">
                            {pr.authorLogin.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {pr.authorLogin}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer watermark */}
      <p className="text-muted-foreground/25 mt-4 flex items-center justify-center gap-1.5 pt-2 text-center text-[11px]">
        <Sparkles className="h-3 w-3" />
        AI Triage powered by GitVision
      </p>
    </div>
  );
}

export default memo(PullRequestsTab);
