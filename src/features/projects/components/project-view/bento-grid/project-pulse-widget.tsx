"use client";

/**
 * Project Pulse Widget v3 — Redesigned for high contrast, vibrant colors,
 * and a true timeline look with a continuous vertical line.
 */

import { memo, useState, useCallback } from "react";
import Image from "next/image";
import {
  GitCommit,
  Sparkles,
  Loader2,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  subDays,
  isAfter,
} from "date-fns";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  useProjectCommits,
  useGenerateAiSummary,
} from "@/features/projects/hooks/use-project";
import type { Commit } from "@/features/projects/types/project.types";

// ─── Hash-based dynamic color generator ──────────────────────────────────────

const HASH_COLORS = [
  "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
  "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
  "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
  "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
];

function getHashColorClasses(hash: string) {
  let num = 0;
  for (let i = 0; i < hash.length; i++) {
    num += hash.charCodeAt(i);
  }
  return HASH_COLORS[num % HASH_COLORS.length];
}

// ─── Date bucket labeling ─────────────────────────────────────────────────────

function dateBucket(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isAfter(date, subDays(new Date(), 7))) return "This Week";
  return format(date, "MMMM yyyy");
}

// ─── Mini frequency chart (7 days) ───────────────────────────────────────────

function FrequencyChart({ commits }: { commits: Commit[] }) {
  const DAY = 86_400_000;
  const now = Date.now();

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * DAY;
    const dayEnd = dayStart + DAY;
    return {
      label: format(new Date(dayStart), "EEE"),
      count: commits.filter((c) => {
        const t = new Date(c.authorDate).getTime();
        return t >= dayStart && t < dayEnd;
      }).length,
    };
  });

  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="flex h-10 items-end gap-1.5">
      {buckets.map((b, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1">
          <div
            className="hover:bg-primary w-full cursor-default rounded-t transition-colors"
            style={{
              height: `${Math.max((b.count / max) * 28, b.count > 0 ? 4 : 2)}px`,
              backgroundColor:
                b.count > 0
                  ? "hsl(var(--primary) / 0.5)"
                  : "hsl(var(--muted-foreground) / 0.15)",
            }}
            title={`${b.count} commit${b.count !== 1 ? "s" : ""}`}
          />
          <span className="text-muted-foreground group-hover:text-foreground font-mono text-[9px] font-medium transition-colors">
            {b.label[0]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Single commit row ────────────────────────────────────────────────────────

interface CommitRowProps {
  commit: Commit;
  repoUrl: string;
  isGenerating: boolean;
  isAnyGenerating: boolean;
  onGenerateSummary: (commitId: string) => void;
  isLast: boolean;
}

function CommitRow({
  commit,
  repoUrl,
  isGenerating,
  isAnyGenerating,
  onGenerateSummary,
  isLast,
}: CommitRowProps) {
  const rawMessage =
    commit.commitMessage.split("\n")[0]?.substring(0, 100) ?? "";

  // Assign a vibrant color based on commit hash
  const colorClasses = getHashColorClasses(commit.commitHash);

  const placeholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(commit.authorName)}&background=random&size=32`;
  const commitUrl = repoUrl
    ? `${repoUrl}/commit/${commit.commitHash}`
    : undefined;

  return (
    <div className="group hover:bg-muted/10 relative -mx-2 flex gap-4 rounded-lg px-2 py-3 transition-colors">
      {/* Timeline line and dot */}
      <div className="relative ml-2 flex flex-col items-center">
        <div
          className={`bg-background mt-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${colorClasses.split(" ")[0].replace("text-", "border-")}`}
        >
          <div
            className={`h-1.5 w-1.5 rounded-full ${colorClasses.split(" ")[0].replace("text-", "bg-")}`}
          />
        </div>
        {!isLast && (
          <div className="bg-border/60 absolute top-6 -bottom-3 w-px" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-2 pb-1">
        {/* Message */}
        <p className="text-foreground line-clamp-1 text-sm leading-snug font-semibold transition-all group-hover:line-clamp-none">
          {rawMessage}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Subtle author avatar and name */}
          <div className="bg-muted/40 border-border/50 flex items-center gap-1.5 rounded-full border px-1.5 py-0.5">
            <Image
              src={commit.authorAvatar || placeholder}
              alt={commit.authorName}
              width={16}
              height={16}
              className="rounded-full object-cover"
            />
            <span className="text-muted-foreground pr-1 text-[10px] font-medium">
              {commit.authorName}
            </span>
          </div>

          <span className="text-muted-foreground text-[11px] font-medium">
            {formatDistanceToNow(new Date(commit.authorDate), {
              addSuffix: true,
            })}
          </span>

          {/* Hash Badge with dynamic color */}
          {commitUrl ? (
            <a
              href={commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`ml-auto cursor-pointer rounded border px-2 py-0.5 font-mono text-[10px] opacity-70 transition-colors hover:opacity-100 ${colorClasses}`}
            >
              {commit.commitHash.slice(0, 7)}
            </a>
          ) : (
            <span
              className={`ml-auto rounded border px-2 py-0.5 font-mono text-[10px] opacity-70 ${colorClasses}`}
            >
              {commit.commitHash.slice(0, 7)}
            </span>
          )}
        </div>

        {/* AI Summary */}
        <div className="mt-1">
          {isGenerating ? (
            <div className="flex items-center gap-2 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-blue-600 dark:text-blue-400">
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              <span className="text-[11px] font-semibold tracking-wide uppercase">
                Generating Analysis...
              </span>
            </div>
          ) : commit.AiSummary ? (
            <div className="bg-primary/5 border-primary/20 flex gap-2 rounded-md border px-3 py-2.5">
              <Sparkles className="text-primary mt-0.5 h-3 w-3 shrink-0" />
              <p className="text-foreground/80 text-xs leading-relaxed font-medium">
                {commit.AiSummary}
              </p>
            </div>
          ) : (
            <div className="mt-0.5 flex opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <Button
                size="sm"
                disabled={isAnyGenerating}
                onClick={() => onGenerateSummary(commit.id)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-6 cursor-pointer gap-1.5 px-2.5 text-[11px] font-semibold shadow-sm"
              >
                <Sparkles className="h-2.5 w-2.5" />
                Analyze Commit
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Date group header ────────────────────────────────────────────────────────

function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="-mx-1 flex items-center gap-3 pt-4 pb-2 first:pt-0">
      <div className="flex w-8 items-center justify-center">
        <CalendarDays className="text-foreground/50 h-3.5 w-3.5" />
      </div>
      <span className="text-foreground/75 text-xs font-bold tracking-wider uppercase">
        {label}
      </span>
      <div className="bg-border/50 h-px flex-1" />
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PulseSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="ml-2 flex flex-col items-center">
            <Skeleton className="mt-1.5 h-4 w-4 rounded-full" />
            <Skeleton className="mt-2 h-12 w-px" />
          </div>
          <div className="flex-1 space-y-3 pt-1">
            <Skeleton className="h-5 w-3/4 rounded" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyPulse() {
  return (
    <div className="border-border/50 bg-muted/20 flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
      <GitCommit className="text-muted-foreground/40 mb-3 h-8 w-8" />
      <p className="text-foreground text-sm font-semibold">
        No commits tracked
      </p>
      <p className="text-muted-foreground mt-1 max-w-50 text-xs">
        Push commits to your repository to see the pulse timeline.
      </p>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

interface ProjectPulseWidgetProps {
  projectId: string;
  repoUrl: string;
}

function ProjectPulseWidget({ projectId, repoUrl }: ProjectPulseWidgetProps) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useProjectCommits(projectId);
  const generateAiSummary = useGenerateAiSummary(projectId);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const cleanRepoUrl = repoUrl.replace(/\.git$/, "");

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

  const commits = data?.pages.flatMap((p) => p.commits) ?? [];

  // Build date-grouped structure
  const grouped: { label: string; commits: Commit[] }[] = [];
  for (const commit of commits) {
    const bucket = dateBucket(new Date(commit.authorDate));
    const last = grouped[grouped.length - 1];
    if (last && last.label === bucket) {
      last.commits.push(commit);
    } else {
      grouped.push({ label: bucket, commits: [commit] });
    }
  }

  return (
    <div className="bg-card flex h-full flex-col rounded-xl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-600/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-foreground text-base leading-tight font-bold tracking-tight">
              Project Pulse
            </h3>
            <p className="text-muted-foreground mt-0.5 text-[11px] font-medium">
              {commits.length > 0
                ? `${commits.length} commit${commits.length !== 1 ? "s" : ""} recorded`
                : "Activity timeline"}
            </p>
          </div>
        </div>
      </div>

      {/* 7-day frequency chart */}
      {!isLoading && commits.length > 0 && (
        <div className="border-border/40 bg-card mb-6 rounded-xl border p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-1.5">
            <div className="bg-primary h-2 w-2 rounded-full" />
            <p className="text-foreground text-[10px] font-bold tracking-wider uppercase">
              Last 7 days
            </p>
          </div>
          <FrequencyChart commits={commits} />
        </div>
      )}

      {/* Feed */}
      {isLoading ? (
        <PulseSkeleton />
      ) : commits.length === 0 ? (
        <EmptyPulse />
      ) : (
        <ScrollArea
          style={{ maxHeight: "500px" }}
          className="-mx-2 flex-1 px-2"
        >
          <div className="pb-4">
            {grouped.map((group, groupIdx) => (
              <div key={group.label} className="mb-2">
                <DateGroupHeader label={group.label} />
                <div className="space-y-1">
                  {group.commits.map((commit, index) => (
                    <CommitRow
                      key={`${commit.id}-${index}`}
                      commit={commit}
                      repoUrl={cleanRepoUrl}
                      isGenerating={generatingId === commit.id}
                      isAnyGenerating={generatingId !== null}
                      onGenerateSummary={handleGenerateSummary}
                      isLast={
                        groupIdx === grouped.length - 1 &&
                        index === group.commits.length - 1
                      }
                    />
                  ))}
                </div>
              </div>
            ))}

            {hasNextPage && (
              <div className="flex justify-center pt-6 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="border-border/50 bg-background hover:bg-muted/50 h-8 gap-2 px-4 text-xs font-semibold transition-colors"
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <GitCommit className="h-3 w-3" />
                  )}
                  {isFetchingNextPage
                    ? "Loading history…"
                    : "Load older commits"}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export default memo(ProjectPulseWidget);
