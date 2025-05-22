"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { memo } from "react";
import { Commit } from "../types";
import CommitItem from "./CommitItem";
import NoCommitFound from "./NoCommitFound";
import Pagination from "./Pagination";

interface CommitListProps {
  isLoading: boolean;
  commits: Commit[];
  totalPages: number;
  totalCommits: number;
  currentPage: number;
  generatingCommitId: string | null;
  cleanRepoUrl: string;
  projectId: string;
  onPageChange: (page: number) => void;
  onGenerateSummary: (commitId: string) => void;
}

const CommitList = ({
  isLoading,
  commits,
  totalPages,
  totalCommits,
  currentPage,
  generatingCommitId,
  cleanRepoUrl,
  onPageChange,
  onGenerateSummary,
}: CommitListProps) => {
  return (
    <div id="commits-section" className="mt-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Recent Commits</h2>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>AI-powered commit summaries</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : commits.length > 0 ? (
        <div className="bg-background/50 rounded-xl p-6 shadow-sm ring-1 ring-border/10">
          <ul className="space-y-6">
            {commits.map((commit, index) => (
              <CommitItem
                key={commit.id}
                commit={commit}
                index={index}
                isLast={index === commits.length - 1}
                generatingCommitId={generatingCommitId}
                repoUrl={cleanRepoUrl}
                onGenerateSummary={onGenerateSummary}
              />
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          )}

          {/* Commit count info */}
          <div className="text-xs text-muted-foreground text-center mt-4">
            Showing {commits.length} of {totalCommits} commits
          </div>
        </div>
      ) : (
        <NoCommitFound />
      )}
    </div>
  );
};

export default memo(CommitList);
