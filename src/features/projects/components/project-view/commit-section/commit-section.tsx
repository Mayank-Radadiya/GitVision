"use client";

/**
 * Commit Section — Displays the commit timeline with "Load More" pagination.
 * Subscribes to useProjectCommits() (useInfiniteQuery) and useGenerateAiSummary().
 * Isolated: rerenders here don't affect header or stats.
 */

import { memo, useState, useCallback } from "react";
import { GitCommit, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
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

  /** Flatten pages into a single commit list */
  const commits = data?.pages.flatMap((page) => page.commits) ?? [];

  /** Handle AI summary generation with loading state */
  const handleGenerateSummary = useCallback(
    (commitId: string) => {
      setGeneratingCommitId(commitId);
      generateAiSummary.mutate(
        { projectId, commitId },
        {
          onSettled: () => setGeneratingCommitId(null),
        },
      );
    },
    [generateAiSummary, projectId],
  );

  /** Clean repo URL (remove .git suffix) */
  const cleanRepoUrl = repoUrl.replace(/\.git$/, "");

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GitCommit className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Recent Commits
          </h2>
          {commits.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({commits.length} loaded)
            </span>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <Skeleton className="h-32 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && commits.length === 0 && (
        <div className="py-16 text-center">
          <GitCommit className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            No commits found for this project.
          </p>
        </div>
      )}

      {/* Commit List */}
      {commits.length > 0 && (
        <div className="space-y-4">
          {commits.map((commit,index) => (
            <CommitCard
              key={index}
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
      )}

      {/* Load More */}
      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="gap-2 cursor-pointer"
          >
            {isFetchingNextPage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {isFetchingNextPage ? "Loading..." : "Load More Commits"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default memo(CommitSection);
