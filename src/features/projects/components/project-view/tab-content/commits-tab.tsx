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
      className={`group border-border/40 border-b transition-all last:border-b-0 ${
        expanded ? "bg-muted/10" : "hover:bg-muted/30"
      }`}
    >
      <div
        className="flex cursor-pointer items-start gap-4 px-5 py-4"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        {/* Dynamic Icon / Avatar Block */}
        <div className="shrink-0 pt-0.5">
          <div className="relative">
            <div
              className={`h-10 w-10 overflow-hidden rounded-full border-2 ${style ? style.border : dynamicStyles.match(/border-[^\s]+/)![0]} shadow-sm`}
            >
              <Image
                src={commit.authorAvatar || placeholder}
                alt={commit.authorName}
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            {/* Small commit icon overlay */}
            <div
              className={`bg-background ring-background absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border ring-2 ${style ? style.border : dynamicStyles.match(/border-[^\s]+/)![0]} shadow-sm`}
            >
              <GitCommit
                className={`h-3 w-3 ${style ? style.color : dynamicStyles.split(" ")[0]}`}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-2">
              {style && prefix ? (
                <Badge
                  variant="outline"
                  className={`h-5 shrink-0 border px-1.5 text-[10px] font-bold ${style.bg} ${style.border} ${style.color} tracking-wider uppercase`}
                >
                  {scope ? `${style.label} (${scope})` : style.label}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={`h-5 shrink-0 border px-1.5 text-[10px] font-bold tracking-wider uppercase ${dynamicStyles}`}
                >
                  Commit
                </Badge>
              )}
            </div>
            <p className="text-foreground truncate pt-0.5 text-[15px] leading-snug font-semibold">
              {rest || firstLine}
            </p>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-foreground/70 text-xs font-semibold">
              {commit.authorName}
            </span>
            <div className="bg-border/80 h-1 w-1 rounded-full" />
            <span className="text-muted-foreground/60 flex items-center gap-1.5 text-[11px] font-medium">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(commit.authorDate), {
                addSuffix: true,
              })}
            </span>
            <div className="bg-border/80 hidden h-1 w-1 rounded-full sm:block" />
            {commitUrl ? (
              <a
                href={commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`hidden cursor-pointer items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-medium transition-colors sm:flex ${dynamicStyles} opacity-80 shadow-sm hover:opacity-100`}
              >
                <Hash className="h-3 w-3" />
                {commit.commitHash.slice(0, 7)}
                <ExternalLink className="ml-0.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            ) : (
              <span
                className={`hidden items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-medium sm:flex ${dynamicStyles} opacity-80 shadow-sm`}
              >
                <Hash className="h-3 w-3" />
                {commit.commitHash.slice(0, 7)}
              </span>
            )}

            {commit.AiSummary && (
              <>
                <div className="bg-border/80 h-1 w-1 rounded-full" />
                <span className="flex items-center gap-1.5 rounded border border-violet-200 bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400">
                  <Sparkles className="h-3 w-3" />
                  AI Summary
                </span>
              </>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <div className="mt-3 shrink-0 sm:mt-1.5">
          <ChevronDown
            className={`text-muted-foreground/40 h-5 w-5 transition-transform duration-200 ${
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
            <div className="ml-14 space-y-4 px-5 pb-5">
              {/* Commit body text */}
              {hasBody && (
                <div className="bg-card border-border/50 rounded-xl border px-4 py-3 shadow-inner">
                  <pre className="text-foreground/80 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                    {bodyLines}
                  </pre>
                </div>
              )}

              {/* AI Summary area */}
              {isGenerating ? (
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="text-xs font-bold tracking-wide uppercase">
                    Analyzing commit payload…
                  </span>
                </div>
              ) : commit.AiSummary ? (
                <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 shadow-sm dark:border-violet-500/20 dark:bg-violet-500/10">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold tracking-widest text-violet-700 uppercase dark:text-violet-400">
                      GitVision Analysis
                    </p>
                    <p className="text-foreground/90 text-sm leading-relaxed font-medium">
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
                  className="h-8 w-fit cursor-pointer gap-2 bg-violet-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
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
    <div className="border-border/50 divide-border/30 bg-card divide-y overflow-hidden rounded-2xl border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-3 pt-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
    <div className="border-border/50 bg-muted/10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 text-center">
      <div className="bg-background border-border mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm">
        <GitCommit className="text-muted-foreground/60 h-6 w-6" />
      </div>
      <h3 className="text-foreground text-lg font-bold">No commits tracked</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm font-medium">
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
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            Commit History
          </h2>
          {!isLoading && totalLoaded > 0 && (
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Showing {totalLoaded} commit{totalLoaded !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {/* AI indicator */}
        <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 shadow-sm dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400">
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
          <div className="border-border/50 bg-card overflow-hidden rounded-2xl border shadow-sm">
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
                className="border-border/50 bg-background hover:bg-muted/50 w-full max-w-sm gap-2.5 text-sm font-bold transition-all"
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
              <span className="text-muted-foreground/40 text-xs font-bold tracking-wider uppercase">
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
