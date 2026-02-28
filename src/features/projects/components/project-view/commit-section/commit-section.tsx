"use client";

/**
 * Commit Section — Bento widget variant.
 * Fixed-height ScrollArea with infinite-load footer.
 * Renders as a self-contained card used inside the bento grid.
 */

import { memo, useState, useCallback } from "react";
import { GitCommit, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Badge } from "@/shared/components/ui/badge";
import {
  useProjectCommits,
  useGenerateAiSummary,
} from "@/features/projects/hooks/use-project";
import CommitCard from "./commit-card";

interface CommitSectionProps {
  projectId: string;
  repoUrl: string;
}

function CommitSection({ projectId, repoUrl }: CommitSectionProps) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useProjectCommits(projectId);

  const generateAiSummary = useGenerateAiSummary(projectId);
  const [generatingCommitId, setGeneratingCommitId] = useState<string | null>(
    null,
  );

  const commits = data?.pages.flatMap((page) => page.commits) ?? [];
  const cleanRepoUrl = repoUrl.replace(/\.git$/, "");

  const handleGenerateSummary = useCallback(
    (commitId: string) => {
      setGeneratingCommitId(commitId);
      generateAiSummary.mutate(
        { projectId, commitId },
        { onSettled: () => setGeneratingCommitId(null) },
      );
    },
    [generateAiSummary, projectId],
  );

  // ─── Loading Skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <Skeleton className="h-20 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
            <GitCommit className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Recent Commits
          </h3>
        </div>
        {commits.length > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] h-5 px-1.5 font-medium tabular-nums"
          >
            {commits.length} loaded
          </Badge>
        )}
      </div>

      {/* Empty State */}
      {commits.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40 border border-border/30">
            <GitCommit className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No commits found
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60 max-w-[200px]">
            This repository has no commits visible yet.
          </p>
        </div>
      )}

      {/* Commits — Scrollable */}
      {commits.length > 0 && (
        <ScrollArea className="flex-1 pr-1" style={{ maxHeight: "520px" }}>
          {/* Timeline wrapper */}
          <div className="relative">
            {/* Vertical connector line behind the avatar column */}
            {commits.length > 1 && (
              <div className="absolute left-[15px] top-8 bottom-8 w-px bg-border/30 pointer-events-none" />
            )}
            <div className="space-y-0.5">
              {commits.map((commit) => (
                <CommitCard
                  key={commit.id}
                  id={commit.id}
                  commitHash={commit.commitHash}
                  commitMessage={commit.commitMessage}
                  aiSummary={commit.AiSummary}
                  authorName={commit.authorName}
                  authorAvatar={commit.authorAvatar}
                  authorDate={commit.authorDate}
                  repoUrl={cleanRepoUrl}
                  isGenerating={generatingCommitId === commit.id}
                  isAnyGenerating={generatingCommitId !== null}
                  onGenerateSummary={handleGenerateSummary}
                />
              ))}
            </div>
          </div>

          {/* Load More */}
          {hasNextPage && (
            <div className="pt-3 pb-1 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2 h-8 text-xs cursor-pointer border-border/40 hover:border-primary/30 hover:bg-primary/5"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {isFetchingNextPage ? "Loading…" : "Load More"}
              </Button>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}

export default memo(CommitSection);
