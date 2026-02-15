"use client";

/**
 * Commit Card — Single commit in the timeline.
 * Handles AI summary display, generation button, and author info.
 * Memo'd to prevent rerender when siblings update.
 */

import { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/shared/components/ui/button";

interface CommitCardProps {
  id: string;
  commitHash: string;
  commitMessage: string;
  aiSummary: string | null;
  authorName: string;
  authorAvatar: string | null | undefined;
  authorDate: Date;
  repoUrl: string;
  isGenerating: boolean;
  isAnyGenerating: boolean;
  onGenerateSummary: (commitId: string) => void;
}

/** Extract first line of commit message, truncate if needed */
function getCommitTitle(message: string): string {
  const firstLine = (message || "").split("\n")[0];
  return firstLine.length > 100
    ? firstLine.substring(0, 100) + "..."
    : firstLine;
}

function CommitCard({
  id,
  commitHash,
  commitMessage,
  aiSummary,
  authorName,
  authorAvatar,
  authorDate,
  repoUrl,
  isGenerating,
  isAnyGenerating,
  onGenerateSummary,
}: CommitCardProps) {
  const placeholderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&size=48`;
  const commitUrl = `${repoUrl}/commit/${commitHash}`;
  const formattedDate = format(new Date(authorDate), "MMM d, yyyy 'at' h:mm a");

  return (
    <div className="flex gap-4">
      {/* Author Avatar */}
      <div className="relative mt-1 flex-shrink-0">
        <div className="h-10 w-10 rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-background shadow-md">
          <Image
            src={authorAvatar || placeholderAvatar}
            alt={`${authorName}'s avatar`}
            className="rounded-full object-cover hover:opacity-80 transition-opacity"
            height={42}
            width={42}
          />
        </div>
      </div>

      {/* Commit Content */}
      <div className="flex-1 rounded-xl border border-border/40 bg-card/80 backdrop-blur-xl overflow-hidden transition-all duration-200 hover:border-primary/20 hover:shadow-md group">
        <div className="p-5">
          {/* Author + Date */}
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group/link"
            >
              <span className="font-medium text-foreground group-hover/link:text-primary">
                {authorName}
              </span>
              <span>committed {formattedDate}</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </Link>
          </div>

          {/* Commit Message */}
          <p className="text-base font-semibold text-foreground leading-snug mb-3">
            {getCommitTitle(commitMessage)}
          </p>

          {/* AI Summary Section */}
          {isGenerating ? (
            /* Loading state */
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 p-3.5">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <div>
                <p className="text-sm font-medium text-primary">
                  Generating AI summary...
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This may take a few seconds
                </p>
              </div>
            </div>
          ) : aiSummary ? (
            /* Summary displayed */
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3.5">
              <div className="flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">
                    AI Summary
                  </p>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {aiSummary}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Generate button */
            <div className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/40 p-3.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                No AI summary available
              </div>
              <Button
                size="sm"
                onClick={() => onGenerateSummary(id)}
                disabled={isAnyGenerating}
                className="gap-1.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 text-white font-medium shadow-md cursor-pointer text-xs"
              >
                <Sparkles className="h-3 w-3" />
                Generate Summary
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CommitCard);
