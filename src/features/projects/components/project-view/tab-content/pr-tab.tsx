"use client";

/**
 * Pull Requests Tab — Premium placeholder list with AI Triage badges.
 */

import { memo, useMemo, useState } from "react";
import {
  GitPullRequest,
  GitPullRequestClosed,
  Sparkles,
  Search,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/components/ui/avatar";
import { useProjectIssues } from "@/features/projects/hooks/use-project";

// ─── Status Config ────────────────────────────────────────────────────────────

// type PRState = "open" | "closed" | string;

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; Icon: React.ElementType }
> = {
  open: {
    label: "Open",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    Icon: GitPullRequest,
  },
  merged: {
    label: "Merged",
    className: "bg-violet-500/10 text-violet-400 border-violet-500/25",
    Icon: GitPullRequestClosed,
  },
  closed: {
    label: "Closed",
    className: "bg-rose-500/10 text-rose-400 border-rose-500/25",
    Icon: GitPullRequestClosed,
  },
};

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const FILTERS = ["All", "Open", "Closed"] as const;
type FilterType = (typeof FILTERS)[number];

// ─── Main Component ───────────────────────────────────────────────────────────

interface PullRequestsTabProps {
  projectId: string;
}

function PullRequestsTab({ projectId }: PullRequestsTabProps) {
  const { data: prs = [], isLoading } = useProjectIssues(projectId, true);
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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search pull requests…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border/40 bg-card/60 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-card/60 p-1 flex-shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeFilter === f
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* PR List */}
      <div className="rounded-2xl border border-border/40 overflow-hidden divide-y divide-border/30 bg-card/40">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading pull requests...
          </div>
        ) : filteredPRs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No pull requests found matching your criteria.
          </div>
        ) : (
          filteredPRs.map((pr) => {
            const statusConfig =
              STATUS_CONFIG[pr.state] || STATUS_CONFIG.closed;
            const StatusIcon = statusConfig.Icon;

            return (
              <div
                key={pr.id}
                className="px-4 py-4 hover:bg-muted/20 transition-colors group cursor-default"
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    <StatusIcon
                      className={`h-4 w-4 ${
                        pr.state === "open"
                          ? "text-emerald-400"
                          : "text-violet-400" // We don't have merged state easily accessible rn so they show as violet
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors leading-snug line-clamp-1">
                        {pr.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={`flex-shrink-0 text-[10px] h-5 px-1.5 border ${statusConfig.className}`}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground/60">
                      <span>#{pr.issueNumber}</span>
                      <span>•</span>
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
                      <span>by</span>
                      <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                        <Avatar className="h-4 w-4 border border-border/50">
                          <AvatarImage src={pr.authorAvatar || ""} />
                          <AvatarFallback className="text-[8px]">
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
      <p className="text-center text-[11px] text-muted-foreground/30 flex items-center justify-center gap-1 mt-4 pt-2">
        <Sparkles className="h-3 w-3" />
        AI Triage powered by GitVision
      </p>
    </div>
  );
}

export default memo(PullRequestsTab);
