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
          <div className="h-5 w-5 rounded-full border-2 border-primary/20" />
          <Loader2 className="absolute inset-0 h-5 w-5 animate-spin text-primary/60" />
        </div>
        <span className="text-xs text-muted-foreground/50 font-medium">
          Loading discussion…
        </span>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center mb-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/25" />
        </div>
        <p className="text-[11px] text-muted-foreground/35 font-medium">
          No comments yet
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-primary/20 via-border/30 to-transparent" />

      <div className="space-y-1">
        {comments.map((comment, idx) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.25 }}
            className="relative flex gap-3 rounded-lg p-2.5 hover:bg-white/[0.04] transition-colors"
          >
            {/* Avatar with ring to cover timeline */}
            <Avatar className="h-[30px] w-[30px] flex-shrink-0 ring-[3px] ring-card z-10 shadow-sm">
              <AvatarImage src={comment.authorAvatar || ""} />
              <AvatarFallback className="text-[9px] bg-gradient-to-br from-primary/20 to-primary/5 text-primary/70 font-bold">
                {comment.authorLogin.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Comment bubble */}
            <div className="flex-1 min-w-0 rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm px-3.5 py-2.5 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11.5px] font-semibold text-foreground">
                  {comment.authorLogin}
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-medium">
                  {formatDistanceToNow(new Date(comment.githubCreatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="text-[12.5px] text-foreground/80 leading-[1.65] whitespace-pre-wrap break-words">
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
          className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full ${
            issue.state === "open"
              ? "bg-gradient-to-b from-emerald-400 to-emerald-400/20"
              : "bg-gradient-to-b from-violet-400 to-violet-400/20"
          }`}
          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        />
      )}

      {/* Clickable issue row */}
      <div
        onClick={onToggle}
        className={`px-5 py-4 transition-all duration-200 cursor-pointer select-none group ${
          isExpanded
            ? "bg-gradient-to-r from-muted/40 via-muted/20 to-transparent"
            : "hover:bg-muted/15"
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Status Icon with subtle glow */}
          <div className="flex-shrink-0 mt-0.5 relative">
            {issue.state === "open" ? (
              <>
                <div className="absolute inset-0 blur-[6px] bg-emerald-400/20 rounded-full" />
                <CircleDot className="h-4 w-4 text-emerald-400 relative" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 blur-[6px] bg-violet-400/20 rounded-full" />
                <CheckCircle2 className="h-4 w-4 text-violet-400 relative" />
              </>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p
                className={`text-sm font-medium leading-snug line-clamp-1 transition-colors duration-200 ${
                  isExpanded
                    ? "text-foreground"
                    : "text-foreground/90 group-hover:text-foreground"
                }`}
              >
                {issue.title}
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover/link:text-foreground group-hover/link:scale-105 transition-all" />
                  </a>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] h-5 px-2 border font-medium ${
                    issue.state === "open"
                      ? "bg-emerald-500/8 text-emerald-400 border-emerald-500/20"
                      : "bg-violet-500/8 text-violet-400 border-violet-500/20"
                  }`}
                >
                  {issue.state === "open" ? "Open" : "Closed"}
                </Badge>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground/60">
              <span className="font-mono text-muted-foreground/40">
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
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground/70">
                <Avatar className="h-4 w-4 ring-1 ring-border/30">
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
            <div className="mx-4 mb-4 rounded-2xl border border-border/35 bg-gradient-to-br from-card to-card/70 backdrop-blur-xl p-4 shadow-lg shadow-black/[0.06]">
              {/* Discussion header */}
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-border/15">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                  <MessageSquare className="h-2.5 w-2.5 text-primary/60" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground/65 uppercase tracking-wider">
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group/search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 group-focus-within/search:text-primary/50 transition-colors" />
          <input
            type="text"
            placeholder="Search issues…"
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
                  layoutId="issue-filter-pill"
                  className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/15"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{f}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Issue List */}
      <div className="rounded-2xl border border-border/40 overflow-hidden divide-y divide-border/25 bg-card/50 backdrop-blur-sm shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="relative">
              <div className="h-8 w-8 rounded-full border-2 border-primary/10" />
              <Loader2 className="absolute inset-0 h-8 w-8 animate-spin text-primary/40" />
            </div>
            <span className="text-xs text-muted-foreground/40 font-medium">
              Loading issues…
            </span>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-10 w-10 rounded-full bg-muted/20 flex items-center justify-center">
              <CircleDot className="h-4 w-4 text-muted-foreground/25" />
            </div>
            <p className="text-sm text-muted-foreground/40 font-medium">
              No issues found
            </p>
            {issues.length === 0 && !searchQuery ? (
              <button
                onClick={() => syncIssues({ projectId })}
                disabled={isSyncing}
                className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
                {isSyncing ? "Syncing from GitHub…" : "Sync Issues from GitHub"}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground/25">
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
      <p className="text-center text-[11px] text-muted-foreground/25 flex items-center justify-center gap-1.5 mt-4 pt-2">
        <Sparkles className="h-3 w-3" />
        AI Triage powered by GitVision
      </p>
    </div>
  );
}

export default memo(IssuesTab);
