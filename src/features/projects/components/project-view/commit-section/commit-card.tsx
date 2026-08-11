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
      <div className="relative mt-1 flex shrink-0 flex-col items-center">
        <div className="ring-border/40 group-hover:ring-primary/30 h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 transition-all">
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
      <div className="min-w-0 flex-1 pb-4">
        <div className="border-border/40 bg-card/60 hover:border-border/70 hover:bg-card/80 rounded-xl border px-4 py-3 backdrop-blur-sm transition-all duration-200">
          {/* Top row: author + hash + date */}
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="text-foreground/90 font-medium">
                {authorName}
              </span>
              <span>·</span>
              <Link
                href={commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-muted/50 hover:bg-primary/10 hover:text-primary border-border/40 inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors"
              >
                <GitCommit className="h-2.5 w-2.5" />
                {shortHash}
                <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-60" />
              </Link>
            </div>
            <span className="text-muted-foreground/60 shrink-0 text-[11px]">
              {formattedDate}
            </span>
          </div>

          {/* Commit message */}
          <p className="text-foreground mb-2 text-sm leading-snug font-medium">
            {getCommitTitle(commitMessage)}
          </p>

          {/* AI Summary area */}
          {isGenerating ? (
            <div className="bg-primary/5 border-primary/20 mt-2 flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
              <Loader2 className="text-primary h-3.5 w-3.5 shrink-0 animate-spin" />
              <div>
                <p className="text-primary text-xs font-medium">
                  Generating AI summary…
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  This may take a few seconds
                </p>
              </div>
            </div>
          ) : aiSummary ? (
            <div className="bg-primary/5 border-primary/20 mt-2 rounded-lg border px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Sparkles className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p className="text-primary mb-1 text-[10px] font-bold tracking-wider uppercase">
                    AI Summary
                  </p>
                  <p className="text-foreground/85 text-xs leading-relaxed whitespace-pre-wrap">
                    {aiSummary}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Hover-reveal Generate button */
            <div className="mt-1.5 flex items-center justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="text-muted-foreground/50 flex items-center gap-1 text-[11px]">
                <Sparkles className="h-3 w-3" />
                No AI summary yet
              </span>
              <Button
                size="sm"
                onClick={() => onGenerateSummary(id)}
                disabled={isAnyGenerating}
                className="from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground h-7 cursor-pointer gap-1.5 border-0 bg-linear-to-br px-2.5 text-[11px] font-medium shadow-md"
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
