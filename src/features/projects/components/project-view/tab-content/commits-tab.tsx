"use client";

/**
 * Commits Tab v3 — High-contrast vibrant design.
 * Features:
 *   - Stronger colors that pop perfectly in both Light and Dark mode.
 *   - Dynamic color assignment for commits without standard prefixes.
 *   - Bold typography and improved hierarchy.
 */

import { memo, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitCommit,
  Sparkles,
  Loader2,
  ChevronDown,
  ExternalLink,
  Calendar,
  Hash,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  useProjectCommits,
  useGenerateAiSummary,
} from "@/features/projects/hooks/use-project";
import type { Commit } from "@/features/projects/types/project.types";
import { useParams as useNextParams } from "next/navigation";

// ─── High Contrast Prefix Map ────────────────────────────────────────────────

const PREFIX_STYLE: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  feat: {
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    label: "Feature",
  },
  fix: {
    color: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
    label: "Fix",
  },
  refactor: {
    color: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-500/15",
    border: "border-violet-500/30",
    label: "Refactor",
  },
  chore: {
    color: "text-zinc-700 dark:text-zinc-400",
    bg: "bg-zinc-500/15",
    border: "border-zinc-500/30",
    label: "Chore",
  },
  docs: {
    color: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-500/15",
    border: "border-sky-500/30",
    label: "Docs",
  },
  style: {
    color: "text-pink-700 dark:text-pink-400",
    bg: "bg-pink-500/15",
    border: "border-pink-500/30",
    label: "Style",
  },
  test: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    label: "Test",
  },
  perf: {
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
    label: "Perf",
  },
  ci: {
    color: "text-cyan-700 dark:text-cyan-400",
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/30",
    label: "CI",
  },
  build: {
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-500/15",
    border: "border-indigo-500/30",
    label: "Build",
  },
};

function parsePrefix(message: string) {
  const match = message.match(/^([a-z]+)(\([^)]*\))?!?:\s*/i);
  if (!match) return { prefix: null, scope: null, rest: message };
  const rawScope = match[2] ? match[2].slice(1, -1) : null;
  return {
    prefix: match[1]!.toLowerCase(),
    scope: rawScope,
    rest: message.slice(match[0].length),
  };
}

// ─── Dynamic Hash Colors ──────────────────────────────────────────────────────

const HASH_COLORS = [
  "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
  "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
  "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20",
  "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20",
  "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
  "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20",
];

function getHashStyles(hash: string) {
  let num = 0;
  for (let i = 0; i < hash.length; i++) {
    num += hash.charCodeAt(i);
  }
  return HASH_COLORS[num % HASH_COLORS.length];
}

// ─── Single Commit Row ────────────────────────────────────────────────────────

interface CommitRowProps {
  commit: Commit;
  repoUrl?: string;
  isGenerating: boolean;
  isAnyGenerating: boolean;
  onGenerateSummary: (commitId: string) => void;
}

function CommitRow({
  commit,
  repoUrl,
  isGenerating,
  isAnyGenerating,
  onGenerateSummary,
}: CommitRowProps) {
  const [expanded, setExpanded] = useState(false);

  const firstLine = commit.commitMessage.split("\n")[0] ?? "";
  const bodyLines = commit.commitMessage.split("\n").slice(1).join("\n").trim();
  const hasBody = bodyLines.length > 0;

  const { prefix, scope, rest } = parsePrefix(firstLine);
  const style = prefix ? PREFIX_STYLE[prefix] : null;

  // If no prefix, we generate a stable vibrant color for this commit based on its hash
  const dynamicStyles = getHashStyles(commit.commitHash);

  const placeholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(commit.authorName)}&background=random&size=32`;
  const commitUrl = repoUrl
    ? `${repoUrl.replace(/\.git$/, "")}/commit/${commit.commitHash}`
    : undefined;

  return (
    <motion.div
      layout
      className={`group border-b border-border/40 last:border-b-0 transition-all ${
        expanded ? "bg-muted/10" : "hover:bg-muted/30"
      }`}
    >
      <div
        className="flex items-start gap-4 px-5 py-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        {/* Dynamic Icon / Avatar Block */}
        <div className="flex-shrink-0 pt-0.5">
          <div className="relative">
            <div
              className={`h-10 w-10 rounded-full overflow-hidden border-2 ${style ? style.border : dynamicStyles.match(/border-[^\s]+/)![0]} shadow-sm`}
            >
              <Image
                src={commit.authorAvatar || placeholder}
                alt={commit.authorName}
                width={40}
                height={40}
                className="object-cover h-full w-full"
              />
            </div>
            {/* Small commit icon overlay */}
            <div
              className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-background border ${style ? style.border : dynamicStyles.match(/border-[^\s]+/)![0]} shadow-sm`}
            >
              <GitCommit
                className={`h-3 w-3 ${style ? style.color : dynamicStyles.split(" ")[0]}`}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              {style && prefix ? (
                <Badge
                  variant="outline"
                  className={`text-[10px] h-5 px-1.5 flex-shrink-0 font-bold border ${style.bg} ${style.border} ${style.color} uppercase tracking-wider`}
                >
                  {scope ? `${style.label} (${scope})` : style.label}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={`text-[10px] h-5 px-1.5 flex-shrink-0 font-bold border uppercase tracking-wider ${dynamicStyles}`}
                >
                  Commit
                </Badge>
              )}
            </div>
            <p className="text-[15px] font-semibold text-foreground leading-snug truncate pt-0.5">
              {rest || firstLine}
            </p>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-foreground/70">
              {commit.authorName}
            </span>
            <div className="h-1 w-1 rounded-full bg-border/80" />
            <span className="text-[11px] font-medium text-muted-foreground/60 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(commit.authorDate), {
                addSuffix: true,
              })}
            </span>
            <div className="h-1 w-1 rounded-full bg-border/80 hidden sm:block" />
            {commitUrl ? (
              <a
                href={commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`hidden sm:flex items-center gap-1 font-mono text-[11px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${dynamicStyles} opacity-80 hover:opacity-100 shadow-sm`}
              >
                <Hash className="h-3 w-3" />
                {commit.commitHash.slice(0, 7)}
                <ExternalLink className="h-3 w-3 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ) : (
              <span
                className={`hidden sm:flex items-center gap-1 font-mono text-[11px] font-medium px-2 py-0.5 rounded border ${dynamicStyles} opacity-80 shadow-sm`}
              >
                <Hash className="h-3 w-3" />
                {commit.commitHash.slice(0, 7)}
              </span>
            )}

            {commit.AiSummary && (
              <>
                <div className="h-1 w-1 rounded-full bg-border/80" />
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/10 px-2 py-0.5 rounded border border-violet-200 dark:border-violet-500/20">
                  <Sparkles className="h-3 w-3" />
                  AI Summary
                </span>
              </>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0 mt-3 sm:mt-1.5">
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground/40 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 ml-14 space-y-4">
              {/* Commit body text */}
              {hasBody && (
                <div className="rounded-xl bg-card border border-border/50 px-4 py-3 shadow-inner">
                  <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
                    {bodyLines}
                  </pre>
                </div>
              )}

              {/* AI Summary area */}
              {isGenerating ? (
                <div className="flex items-center gap-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-4 py-3 text-blue-700 dark:text-blue-400 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  <span className="text-xs font-bold tracking-wide uppercase">
                    Analyzing commit payload…
                  </span>
                </div>
              ) : commit.AiSummary ? (
                <div className="rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 px-4 py-3 flex gap-3 shadow-sm">
                  <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-widest mb-1.5">
                      GitVision Analysis
                    </p>
                    <p className="text-sm font-medium text-foreground/90 leading-relaxed">
                      {commit.AiSummary}
                    </p>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  disabled={isAnyGenerating}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateSummary(commit.id);
                  }}
                  className="h-8 px-4 gap-2 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-600 dark:hover:bg-violet-500 shadow-sm cursor-pointer w-fit"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate AI Analysis
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function CommitsSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/30 bg-card">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-2/3 rounded" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-3 w-14 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyCommits() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background border border-border mb-4 shadow-sm">
        <GitCommit className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-bold text-foreground">No commits tracked</h3>
      <p className="text-sm font-medium text-muted-foreground mt-1 max-w-sm">
        Connect your repository and push code to see a vibrant timeline of your
        project&apos;s history here.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CommitsTab() {
  const params = useNextParams();
  const projectId = params.projectId as string;

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useProjectCommits(projectId);

  const generateAiSummary = useGenerateAiSummary(projectId);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleGenerateSummary = useCallback(
    (commitId: string) => {
      setGeneratingId(commitId);
      generateAiSummary.mutate(
        { projectId, commitId },
        { onSettled: () => setGeneratingId(null) },
      );
    },
    [generateAiSummary, projectId],
  );

  const allCommits = data?.pages.flatMap((p) => p.commits) ?? [];
  const totalLoaded = allCommits.length;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Commit History
          </h2>
          {!isLoading && totalLoaded > 0 && (
            <p className="text-sm font-medium text-muted-foreground mt-1">
              Showing {totalLoaded} commit{totalLoaded !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {/* AI indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-500/20 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Click rows for AI Analysis</span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <CommitsSkeleton />
      ) : allCommits.length === 0 ? (
        <EmptyCommits />
      ) : (
        <>
          <div className="rounded-2xl border border-border/50 overflow-hidden bg-card shadow-sm">
            {allCommits.map((commit, index) => (
              <CommitRow
                key={`${commit.id}-${index}`}
                commit={commit}
                isGenerating={generatingId === commit.id}
                isAnyGenerating={generatingId !== null}
                onGenerateSummary={handleGenerateSummary}
              />
            ))}
          </div>

          {/* Pagination */}
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2.5 font-bold border-border/50 bg-background hover:bg-muted/50 transition-all text-sm w-full max-w-sm"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitCommit className="h-4 w-4" />
                )}
                {isFetchingNextPage ? "Loading history…" : "Load older commits"}
              </Button>
            </div>
          )}

          {!hasNextPage && totalLoaded > 0 && (
            <div className="flex justify-center pt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/40">
                End of History
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default memo(CommitsTab);
