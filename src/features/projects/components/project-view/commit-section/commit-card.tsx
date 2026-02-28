"use client";

/**
 * Commit Card — Timeline-style single commit entry.
 * "Generate AI Summary" button appears on hover for clean visual hierarchy.
 * AI summary is disclosed below the message in an accent-bordered block.
 */

import { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Sparkles, Loader2, GitCommit } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { motion } from "framer-motion";

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

function getCommitTitle(message: string): string {
  const firstLine = (message || "").split("\n")[0];
  return firstLine.length > 90 ? firstLine.substring(0, 90) + "…" : firstLine;
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
  const placeholderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&size=32`;
  const commitUrl = `${repoUrl}/commit/${commitHash}`;
  const formattedDate = format(new Date(authorDate), "MMM d, h:mm a");
  const shortHash = commitHash.slice(0, 7);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="group relative flex gap-3"
    >
      {/* Timeline connector dot */}
      <div className="relative flex flex-col items-center flex-shrink-0 mt-1">
        <div className="h-8 w-8 rounded-full ring-1 ring-border/40 group-hover:ring-primary/30 transition-all overflow-hidden flex-shrink-0">
          <Image
            src={authorAvatar || placeholderAvatar}
            alt={`${authorName}'s avatar`}
            className="object-cover"
            height={32}
            width={32}
          />
        </div>
        {/* Vertical line (drawn by parent) */}
      </div>

      {/* Card body */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm px-4 py-3 transition-all duration-200 hover:border-border/70 hover:bg-card/80">
          {/* Top row: author + hash + date */}
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/90">
                {authorName}
              </span>
              <span>·</span>
              <Link
                href={commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[11px] bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/40 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
              >
                <GitCommit className="h-2.5 w-2.5" />
                {shortHash}
                <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </Link>
            </div>
            <span className="text-[11px] text-muted-foreground/60 flex-shrink-0">
              {formattedDate}
            </span>
          </div>

          {/* Commit message */}
          <p className="text-sm font-medium text-foreground leading-snug mb-2">
            {getCommitTitle(commitMessage)}
          </p>

          {/* AI Summary area */}
          {isGenerating ? (
            <div className="flex items-center gap-2.5 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 mt-2">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-primary">
                  Generating AI summary…
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  This may take a few seconds
                </p>
              </div>
            </div>
          ) : aiSummary ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 mt-2">
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                    AI Summary
                  </p>
                  <p className="text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {aiSummary}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Hover-reveal Generate button */
            <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1.5">
              <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                No AI summary yet
              </span>
              <Button
                size="sm"
                onClick={() => onGenerateSummary(id)}
                disabled={isAnyGenerating}
                className="h-7 px-2.5 gap-1.5 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 border-0 text-primary-foreground font-medium shadow-md cursor-pointer text-[11px]"
              >
                <Sparkles className="h-3 w-3" />
                Generate AI Summary
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default memo(CommitCard);
