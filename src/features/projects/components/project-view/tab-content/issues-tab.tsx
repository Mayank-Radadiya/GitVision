"use client";

/**
 * Issues Tab — Premium design with animated expandable comments.
 */

import { memo, useMemo, useState } from "react";
import {
  CircleDot,
  CheckCircle2,
  Sparkles,
  Search,
  ExternalLink,
  MessageSquare,
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
  useIssueComments,
  useSyncIssues,
} from "@/features/projects/hooks/use-project";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

// ─── Filters ─────────────────────────────────────────────────────────────────
const FILTERS = ["All", "Open", "Closed"] as const;
type FilterType = (typeof FILTERS)[number];

// ─── Comment Section ──────────────────────────────────────────────────────────

function IssueComments({ issueId }: { issueId: string }) {
  const { data: comments = [], isLoading } = useIssueComments(issueId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-8">
        <div className="relative">
          <div className="border-primary/20 h-5 w-5 rounded-full border-2" />
          <Loader2 className="text-primary/60 absolute inset-0 h-5 w-5 animate-spin" />
        </div>
        <span className="text-muted-foreground/50 text-xs font-medium">
          Loading discussion…
        </span>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="bg-muted/30 mb-2 flex h-8 w-8 items-center justify-center rounded-full">
          <MessageSquare className="text-muted-foreground/25 h-3.5 w-3.5" />
        </div>
        <p className="text-muted-foreground/35 text-[11px] font-medium">
          No comments yet
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="from-primary/20 via-border/30 absolute top-4 bottom-4 left-3.75 w-px bg-linear-to-b to-transparent" />

      <div className="space-y-1">
        {comments.map((comment, idx) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.25 }}
            className="relative flex gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/4"
          >
            {/* Avatar with ring to cover timeline */}
            <Avatar className="ring-card z-10 h-7.5 w-7.5 shrink-0 shadow-sm ring-[3px]">
              <AvatarImage src={comment.authorAvatar || ""} />
              <AvatarFallback className="from-primary/20 to-primary/5 text-primary/70 bg-linear-to-br text-[9px] font-bold">
                {comment.authorLogin.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Comment bubble */}
            <div className="border-border/40 bg-card/80 min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-foreground text-[11.5px] font-semibold">
                  {comment.authorLogin}
                </span>
                <span className="text-muted-foreground/60 text-[10px] font-medium">
                  {formatDistanceToNow(new Date(comment.githubCreatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="text-foreground/80 text-[12.5px] leading-[1.65] wrap-break-word whitespace-pre-wrap">
                {comment.body}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Single Issue Row ─────────────────────────────────────────────────────────

interface IssueRowProps {
  issue: {
    id: string;
    title: string;
    issueNumber: number;
    state: string;
    authorLogin: string;
    authorAvatar: string | null;
    githubUpdatedAt: Date | null;
    githubCreatedAt: Date | null;
  };
  repoUrl?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function IssueRow({ issue, repoUrl, isExpanded, onToggle }: IssueRowProps) {
  // Prefetch comments in the background so they appear instantly when expanded
  useIssueComments(issue.id);

  const githubUrl = repoUrl
    ? `${repoUrl.replace(/\.git$/, "")}/issues/${issue.issueNumber}`
    : null;

  return (
    <div className="relative">
      {/* Accent gradient bar on left when expanded */}
      {isExpanded && (
        <motion.div
          layoutId="issue-accent"
          className={cn(
            "absolute top-0 bottom-0 left-0 w-0.75 rounded-r-full bg-linear-to-b",
            issue.state === "open"
              ? "from-emerald-400 to-emerald-400/20"
              : "from-violet-400 to-violet-400/20",
          )}
          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        />
      )}

      {/* Clickable issue row */}
      <div
        onClick={onToggle}
        className={cn(
          "group cursor-pointer px-5 py-4 transition-all duration-200 select-none",
          isExpanded
            ? "from-muted/40 via-muted/20 bg-linear-to-r to-transparent"
            : "hover:bg-muted/15",
        )}
      >
        <div className="flex items-start gap-3">
          {/* Status Icon with subtle glow */}
          <div className="relative mt-0.5 shrink-0">
            {issue.state === "open" ? (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-[6px]" />
                <CircleDot className="relative h-4 w-4 text-emerald-400" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 rounded-full bg-violet-400/20 blur-[6px]" />
                <CheckCircle2 className="relative h-4 w-4 text-violet-400" />
              </>
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p
                className={cn(
                  "line-clamp-1 text-sm leading-snug font-medium transition-colors duration-200",
                  isExpanded
                    ? "text-foreground"
                    : "text-foreground/90 group-hover:text-foreground",
                )}
              >
                {issue.title}
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="text-muted-foreground/50 group-hover/link:text-foreground h-3.5 w-3.5 transition-all group-hover/link:scale-105" />
                  </a>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 border px-2 text-[10px] font-medium",
                    issue.state === "open"
                      ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-400"
                      : "border-violet-500/20 bg-violet-500/8 text-violet-400",
                  )}
                >
                  {issue.state === "open" ? "Open" : "Closed"}
                </Badge>
              </div>
            </div>

            {/* Meta row */}
            <div className="text-muted-foreground/60 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-muted-foreground/40 font-mono">
                #{issue.issueNumber}
              </span>
              <span className="text-muted-foreground/35">•</span>
              <span>
                {issue.state === "open" ? "opened" : "updated"}{" "}
                {formatDistanceToNow(
                  new Date(
                    issue.githubUpdatedAt ||
                      issue.githubCreatedAt ||
                      Date.now(),
                  ),
                  { addSuffix: true },
                )}
              </span>
              <span className="text-muted-foreground/35">•</span>
              <div className="text-muted-foreground/70 flex items-center gap-1.5 font-medium">
                <Avatar className="ring-border/30 h-4 w-4 ring-1">
                  <AvatarImage src={issue.authorAvatar || ""} />
                  <AvatarFallback className="text-[7px] font-bold">
                    {issue.authorLogin.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {issue.authorLogin}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Comments Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-border/35 from-card to-card/70 mx-4 mb-4 rounded-2xl border bg-linear-to-br p-4 shadow-lg shadow-black/6 backdrop-blur-xl">
              {/* Discussion header */}
              <div className="border-border/15 mb-3 flex items-center gap-2 border-b pb-2.5">
                <div className="bg-primary/10 flex h-5 w-5 items-center justify-center rounded-md">
                  <MessageSquare className="text-primary/60 h-2.5 w-2.5" />
                </div>
                <span className="text-muted-foreground/65 text-[11px] font-semibold tracking-wider uppercase">
                  Discussion
                </span>
              </div>

              <IssueComments issueId={issue.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface IssuesTabProps {
  projectId: string;
  repoUrl?: string;
}

function IssuesTab({ projectId, repoUrl }: IssuesTabProps) {
  const { data: issues = [], isLoading } = useProjectIssues(projectId, false);
  const { mutate: syncIssues, isPending: isSyncing } = useSyncIssues(projectId);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSearch = issue.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (activeFilter === "Open" && issue.state !== "open") return false;
      if (activeFilter === "Closed" && issue.state !== "closed") return false;
      return matchesSearch;
    });
  }, [issues, activeFilter, searchQuery]);

  const toggleExpanded = (issueId: string) => {
    setExpandedIssueId((prev) => (prev === issueId ? null : issueId));
  };

  return (
    <div className="space-y-4">
      {/* Search + Filter Row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="group/search relative flex-1">
          <Search className="text-muted-foreground/40 group-focus-within/search:text-primary/50 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 transition-colors" />
          <input
            type="text"
            placeholder="Search issues…"
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
                  layoutId="issue-filter-pill"
                  className="bg-primary/10 border-primary/15 absolute inset-0 rounded-lg border"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{f}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Issue List */}
      <div className="border-border/40 divide-border/25 bg-card/50 divide-y overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="relative">
              <div className="border-primary/10 h-8 w-8 rounded-full border-2" />
              <Loader2 className="text-primary/40 absolute inset-0 h-8 w-8 animate-spin" />
            </div>
            <span className="text-muted-foreground/40 text-xs font-medium">
              Loading issues…
            </span>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="bg-muted/20 flex h-10 w-10 items-center justify-center rounded-full">
              <CircleDot className="text-muted-foreground/25 h-4 w-4" />
            </div>
            <p className="text-muted-foreground/40 text-sm font-medium">
              No issues found
            </p>
            {issues.length === 0 && !searchQuery ? (
              <button
                onClick={() => syncIssues({ projectId })}
                disabled={isSyncing}
                className="border-border/40 bg-card/60 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
                {isSyncing ? "Syncing from GitHub…" : "Sync Issues from GitHub"}
              </button>
            ) : (
              <p className="text-muted-foreground/25 text-xs">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              repoUrl={repoUrl}
              isExpanded={expandedIssueId === issue.id}
              onToggle={() => toggleExpanded(issue.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <p className="text-muted-foreground/25 mt-4 flex items-center justify-center gap-1.5 pt-2 text-center text-[11px]">
        <Sparkles className="h-3 w-3" />
        AI Triage powered by GitVision
      </p>
    </div>
  );
}

export default memo(IssuesTab);
