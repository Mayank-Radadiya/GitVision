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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group/search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 group-focus-within/search:text-primary/50 transition-colors" />
          <input
            type="text"
            placeholder="Search pull requests…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/30 transition-all duration-200"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-1 flex-shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                activeFilter === f
                  ? "text-primary"
                  : "text-muted-foreground/60 hover:text-foreground"
              }`}
            >
              {activeFilter === f && (
                <motion.div
                  layoutId="pr-filter-pill"
                  className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/15"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{f}</span>
            </button>
          ))}
        </div>
      </div>

      {/* PR List */}
      <div className="rounded-2xl border border-border/40 overflow-hidden divide-y divide-border/25 bg-card/50 backdrop-blur-sm shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="relative">
              <div className="h-8 w-8 rounded-full border-2 border-primary/10" />
              <Loader2 className="absolute inset-0 h-8 w-8 animate-spin text-primary/40" />
            </div>
            <span className="text-xs text-muted-foreground/40 font-medium">
              Loading pull requests…
            </span>
          </div>
        ) : filteredPRs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-10 w-10 rounded-full bg-muted/20 flex items-center justify-center">
              <GitPullRequest className="h-4 w-4 text-muted-foreground/25" />
            </div>
            <p className="text-sm text-muted-foreground/40 font-medium">
              No pull requests found
            </p>
            {prs.length === 0 && !searchQuery ? (
              <button
                onClick={() => syncIssues({ projectId })}
                disabled={isSyncing}
                className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
                {isSyncing ? "Syncing from GitHub…" : "Sync PRs from GitHub"}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground/25">
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
                className="relative px-5 py-4 transition-all duration-200 hover:bg-muted/15 group cursor-default"
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon with subtle glow */}
                  <div className="flex-shrink-0 mt-0.5 relative">
                    <div
                      className={`absolute inset-0 blur-[6px] rounded-full ${statusConfig.glow}`}
                    />
                    <StatusIcon
                      className={`h-4 w-4 relative ${statusConfig.color}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors duration-200 leading-snug line-clamp-1">
                        {pr.title}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        {githubUrl && (
                          <a
                            href={githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted/30 transition-all cursor-pointer group/link"
                            title="View on GitHub"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover/link:text-foreground group-hover/link:scale-105 transition-all" />
                          </a>
                        )}
                        <Badge
                          variant="outline"
                          className={`flex-shrink-0 text-[10px] h-5 px-2 border font-medium ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground/60">
                      <span className="font-mono text-muted-foreground/40">
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
                      <div className="flex items-center gap-1.5 font-medium text-muted-foreground/70">
                        <Avatar className="h-4 w-4 ring-1 ring-border/30">
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
      <p className="text-center text-[11px] text-muted-foreground/25 flex items-center justify-center gap-1.5 mt-4 pt-2">
        <Sparkles className="h-3 w-3" />
        AI Triage powered by GitVision
      </p>
    </div>
  );
}

export default memo(PullRequestsTab);
