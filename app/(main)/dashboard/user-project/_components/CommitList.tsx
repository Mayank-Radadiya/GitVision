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
    <div id="commits-section" className="mt-10 max-w-screen-2xl mx-auto">
      {/* Enhanced Section Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/30">
        <h2 className="text-3xl font-bold font-[family-name:var(--font-fira-code)] bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Recent Commits
        </h2>
        <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full border border-primary/20 backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary font-[family-name:var(--font-fira-sans)]">
            AI-powered summaries
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : commits.length > 0 ? (
        <div className="bg-gradient-to-br from-background/50 to-background/30 rounded-2xl p-8 shadow-lg backdrop-blur-sm border border-border/30">
          <ul className="space-y-8">
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
          <div className="text-sm text-muted-foreground text-center mt-6 font-[family-name:var(--font-fira-sans)]">
            Showing{" "}
            <span className="font-semibold text-foreground font-[family-name:var(--font-fira-code)]">
              {commits.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground font-[family-name:var(--font-fira-code)]">
              {totalCommits.toLocaleString()}
            </span>{" "}
            commits
          </div>
        </div>
      ) : (
        <NoCommitFound />
      )}
    </div>
  );
};

export default memo(CommitList);
