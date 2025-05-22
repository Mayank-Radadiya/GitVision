"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExternalLink, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { Commit } from "../types";
import { format } from "date-fns";

interface CommitItemProps {
  commit: Commit;
  index: number;
  isLast: boolean;
  generatingCommitId: string | null;
  repoUrl: string;
  onGenerateSummary: (commitId: string) => void;
}

const CommitItem = ({
  commit,
  isLast,
  generatingCommitId,
  repoUrl,
  onGenerateSummary,
}: CommitItemProps) => {
  const formatCommitDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
  };

  const getCommitTitle = (message: string) => {
    if (!message) return "";
    const firstLine = message.split("\n")[0];

    // Truncate if too long
    if (firstLine.length > 100) {
      return firstLine.substring(0, 100) + "...";
    }

    return firstLine;
  };

  const placeholderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    commit.authorName
  )}&background=random`;

  return (
    <li className="relative flex gap-x-4">
      {/* Timeline line */}
      <div
        className={cn(
          isLast ? "h-6" : "-bottom-6",
          "absolute left-0 top-0 flex w-6 justify-center"
        )}
      >
        <div className="w-px bg-border dark:bg-border/60 translate-x-1" />
      </div>

      {/* Author Avatar */}
      <div className="relative mt-4 flex h-10 w-10 flex-none items-center justify-center bg-muted rounded-full ring-2 ring-border/40 shadow-inner">
        <Image
          src={commit.authorAvatar || placeholderAvatar}
          alt={`${commit.authorName}'s avatar`}
          className="rounded-full"
          width={40}
          height={40}
        />
      </div>

      {/* Commit Content */}
      <div className="flex-1 bg-card backdrop-blur-sm p-4 rounded-lg ring-1 ring-border hover:ring-2 hover:ring-primary/30 transition-all duration-200 shadow-sm">
        {/* Commit Info Header */}
        <div className="flex justify-between gap-x-4">
          <Link
            href={`${repoUrl}/commit/${commit.commitHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
            aria-label="View commit on GitHub"
          >
            <span className="font-semibold text-foreground">
              {commit.authorName}
            </span>
            <span className="text-xs">
              committed {formatCommitDate(commit.authorDate)}
            </span>
            <ExternalLink className="size-3" />
          </Link>
        </div>

        {/* Commit Message */}
        <div className="mt-2 font-medium text-foreground">
          {getCommitTitle(commit.commitMessage)}
        </div>

        {/* AI Summary States */}
        {generatingCommitId === commit.id ? (
          <div className="mt-3 bg-muted/40 rounded-md p-3 border border-border/30 flex items-center gap-3">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-sm font-medium text-primary">
                Generating AI summary...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This may take a few seconds.
              </p>
            </div>
          </div>
        ) : commit.AiSummary ? (
          <div className="mt-3 bg-primary/5 rounded-md p-3 border border-primary/20 hover:border-primary/30 transition-colors">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
              <div className="w-full">
                <div className="text-xs font-semibold text-primary mb-1 tracking-wide">
                  AI Summary
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">
                  {commit.AiSummary}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 bg-muted/20 rounded-md p-3 border border-muted flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              No AI summary available
            </div>
            <Button
              className="text-xs flex items-center gap-1.5"
              variant="outline"
              size="sm"
              onClick={() => onGenerateSummary(commit.id)}
              disabled={generatingCommitId !== null}
              aria-label="Generate AI summary"
            >
              <Sparkles className="h-3 w-3" />
              Generate Summary
            </Button>
          </div>
        )}
      </div>
    </li>
  );
};

export default memo(CommitItem);
