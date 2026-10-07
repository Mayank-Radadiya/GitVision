"use client";

/**
 * Commits Tab v3 — High-contrast vibrant design.
 * Features:
 *   - Stronger colors that pop perfectly in both Light and Dark mode.
 *   - Dynamic color assignment for commits without standard prefixes.
 *   - Bold typography and improved hierarchy.
 */

import { memo, useState, useCallback, useMemo } from "react";
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
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { Input } from "@/shared/components/ui/input";
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

const PREFIX_STYLE = Object.fromEntries(
  Object.entries({
    feat: "Feature",
    fix: "Fix",
    refactor: "Refactor",
    chore: "Chore",
    docs: "Docs",
    style: "Style",
    test: "Test",
    perf: "Perf",
    ci: "CI",
    build: "Build",
  }).map(([prefix, label]) => [
    prefix,
    {
      color: "text-muted-foreground",
      bg: "bg-muted",
      border: "border-border",
      label,
    },
  ]),
);

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
  const panelId = `commit-panel-${commit.commitHash}`;

  const firstLine = commit.commitMessage.split("\n")[0] ?? "";
  const bodyLines = commit.commitMessage.split("\n").slice(1).join("\n").trim();
  const hasBody = bodyLines.length > 0;

  const { prefix, scope, rest } = parsePrefix(firstLine);
  const style = prefix ? PREFIX_STYLE[prefix] : null;

  // If no prefix, we generate a stable vibrant color for this commit based on its hash
  const dynamicStyles = "text-muted-foreground bg-muted/40 border-border";

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
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (
              e.target !== e.currentTarget &&
              (e.target as HTMLElement).tagName === "A"
            ) {
              return;
            }
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="focus-visible:ring-primary/40 flex cursor-pointer items-start gap-4 px-5 py-4 focus-visible:ring-1 focus-visible:outline-none"
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
                  className={`h-5 shrink-0 border px-1.5 text-xs font-semibold ${style.bg} ${style.border} ${style.color} tracking-wider uppercase`}
                >
                  {scope ? `${style.label} (${scope})` : style.label}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={`h-5 shrink-0 border px-1.5 text-xs font-semibold tracking-wider uppercase ${dynamicStyles}`}
                >
                  Commit
                </Badge>
              )}
            </div>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="text-foreground truncate pt-0.5 text-left text-[15px] leading-snug font-semibold"
            >
              {rest || firstLine}
            </button>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-foreground/70 text-xs font-semibold">
              {commit.authorName}
            </span>
            <div className="bg-border/80 h-1 w-1 rounded-full" />
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
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
                className={`hidden cursor-pointer items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs font-medium transition-colors sm:flex ${dynamicStyles} opacity-80 shadow-sm hover:opacity-100`}
              >
                <Hash className="h-3 w-3" />
                {commit.commitHash.slice(0, 7)}
                <ExternalLink className="ml-0.5 h-3 w-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100" />
              </a>
            ) : (
              <span
                className={`hidden items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs font-medium sm:flex ${dynamicStyles} opacity-80 shadow-sm`}
              >
                <Hash className="h-3 w-3" />
                {commit.commitHash.slice(0, 7)}
              </span>
            )}

            {commit.aiSummary && (
              <>
                <div className="bg-border/80 h-1 w-1 rounded-full" />
                <span className="border-border bg-primary/10 text-primary flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold">
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
            className={`text-muted-foreground h-5 w-5 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
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
                <div className="border-border bg-primary/10 text-primary flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    Analyzing commit payload…
                  </span>
                </div>
              ) : commit.aiSummary ? (
                <div className="border-border bg-primary/10 flex gap-3 rounded-xl border px-4 py-3 shadow-sm">
                  <Sparkles className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-primary mb-1.5 text-xs font-semibold tracking-widest uppercase">
                      GitVision Analysis
                    </p>
                    <p className="text-foreground/90 text-sm leading-relaxed font-medium">
                      {commit.aiSummary}
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
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-fit cursor-pointer gap-2 px-4 text-xs font-medium shadow-xs"
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
    <div className="border-border/50 divide-border/30 bg-card divide-y overflow-hidden rounded-xl border">
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
    <div className="border-border/50 bg-muted/10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
      <div className="bg-background border-border mb-4 flex h-14 w-14 items-center justify-center rounded-xl border shadow-sm">
        <GitCommit className="text-muted-foreground h-6 w-6" />
      </div>
      <h3 className="text-foreground text-lg font-semibold">
        No commits tracked
      </h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm font-medium">
        Connect your repository and push code to see a vibrant timeline of your
        project&apos;s history here.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CommitsTab({ repoUrl }: { repoUrl?: string }) {
  const params = useNextParams();
  const projectId = params.projectId as string;

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useProjectCommits(projectId);

  const generateAiSummary = useGenerateAiSummary(projectId);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleGenerateSummary = useCallback(
    (commitId: string) => {
      setGeneratingId(commitId);
      generateAiSummary.mutate(
        { projectId, commitId },
        {
          onSettled: () => setGeneratingId(null),
          onSuccess: () => toast.success("Commit analysis ready"),
          onError: (error) =>
            toast.error(error.message || "Couldn’t analyze this commit"),
        },
      );
    },
    [generateAiSummary, projectId],
  );

  const allCommits = useMemo(
    () => data?.pages.flatMap((p) => p.commits) ?? [],
    [data],
  );
  const filteredCommits = useMemo(
    () =>
      allCommits
        .filter((commit) =>
          `${commit.commitMessage} ${commit.authorName} ${commit.commitHash}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (new Date(b.authorDate).getTime() -
              new Date(a.authorDate).getTime()) *
            (sort === "newest" ? 1 : -1),
        ),
    [allCommits, search, sort],
  );
  const totalLoaded = allCommits.length;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-foreground text-xl font-semibold tracking-tight">
            Commit History
          </h2>
          {!isLoading && totalLoaded > 0 && (
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Showing {totalLoaded} commit{totalLoaded !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {/* AI indicator */}
        <div className="border-border bg-primary/10 text-primary flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Click rows for AI Analysis</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            aria-label="Search commits"
            placeholder="Search message, author, or hash…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Sort commits"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      {isError && (
        <div
          role="alert"
          className="border-destructive/30 flex items-center justify-between rounded-xl border p-4 text-sm"
        >
          <p>Couldn’t load commit history.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Search and sorting apply to loaded history. Load older commits to
        include more results.
      </p>
      {/* List */}
      {isLoading ? (
        <CommitsSkeleton />
      ) : allCommits.length === 0 ? (
        <EmptyCommits />
      ) : (
        <>
          <div className="border-border/50 bg-card overflow-hidden rounded-xl border shadow-sm">
            {filteredCommits.length === 0 && (
              <p className="text-muted-foreground p-8 text-center text-sm">
                No matching commits. Try a different search.
              </p>
            )}
            {filteredCommits.map((commit, index) => (
              <CommitRow
                key={`${commit.id}-${index}`}
                commit={commit}
                repoUrl={repoUrl}
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
                className="border-border/50 bg-background hover:bg-muted/50 w-full max-w-sm gap-2.5 text-sm font-semibold transition-all"
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
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
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
