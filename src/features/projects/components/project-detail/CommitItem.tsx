"use client";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
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
    commit.authorName,
  )}&background=random`;

  return (
    <li className="relative flex gap-x-5">
      {/* Enhanced Timeline Connector */}
      <div
        className={cn(
          isLast ? "h-8" : "-bottom-6",
          "absolute left-0 top-0 flex w-12 justify-center",
        )}
      >
        <div className="w-0.5 bg-gradient-to-b from-border via-primary/30 to-border translate-x-1.5" />
      </div>

      {/* Enhanced Author Avatar with Glow */}
      <div className="relative mt-5 flex h-12 w-12 flex-none items-center justify-center">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-md" />

        {/* Avatar Container */}
        <div className="relative h-full w-full rounded-full ring-2 ring-primary/40 ring-offset-2 ring-offset-background shadow-lg overflow-hidden hover:ring-primary/60 transition-all duration-200">
          <Image
            src={commit.authorAvatar || placeholderAvatar}
            alt={`${commit.authorName}'s avatar`}
            className="rounded-full object-cover"
            fill
            sizes="48px"
          />
        </div>
      </div>

      {/* Enhanced Glassmorphism Commit Card */}
      <div className="flex-1 bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-xl rounded-2xl border border-border/40 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl overflow-hidden group cursor-pointer relative">
        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Content */}
        <div className="relative z-10 p-5">
          {/* Commit Info Header */}
          <div className="flex justify-between gap-x-4 mb-3">
            <Link
              href={`${repoUrl}/commit/${commit.commitHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 flex items-center gap-2 group/link cursor-pointer font-[family-name:var(--font-fira-sans)]"
              aria-label="View commit on GitHub"
            >
              <span className="font-semibold text-foreground group-hover/link:text-primary transition-colors">
                {commit.authorName}
              </span>
              <span className="text-xs">
                committed {formatCommitDate(commit.authorDate)}
              </span>
              <ExternalLink className="size-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </Link>
          </div>

          {/* Commit Message */}
          <div className="mb-4 text-lg font-semibold text-foreground font-[family-name:var(--font-fira-code)] leading-snug">
            {getCommitTitle(commit.commitMessage)}
          </div>

          {/* AI Summary States */}
          {generatingCommitId === commit.id ? (
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/30 flex items-center gap-4 backdrop-blur-sm">
              <div className="h-5 w-5 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-semibold text-primary font-[family-name:var(--font-fira-sans)]">
                  Generating AI summary...
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-[family-name:var(--font-fira-sans)]">
                  This may take a few seconds.
                </p>
              </div>
            </div>
          ) : commit.AiSummary ? (
            <div className="bg-gradient-to-br from-primary/8 to-secondary/5 rounded-xl p-4 border border-primary/30 hover:border-primary/50 transition-all duration-200 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-primary mb-2 uppercase tracking-wider font-[family-name:var(--font-fira-code)]">
                    AI Summary
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-[family-name:var(--font-fira-sans)]">
                    {commit.AiSummary}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50 flex items-center justify-between backdrop-blur-sm">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-[family-name:var(--font-fira-sans)]">
                <Sparkles className="h-4 w-4" />
                No AI summary available
              </div>
              <Button
                className="gap-2 bg-gradient-to-br from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#F97316] border-0 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer font-[family-name:var(--font-fira-sans)]"
                variant="outline"
                size="sm"
                onClick={() => onGenerateSummary(commit.id)}
                disabled={generatingCommitId !== null}
                aria-label="Generate AI summary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate Summary
              </Button>
            </div>
          )}
        </div>

        {/* Bottom Border Accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>
    </li>
  );
};

export default memo(CommitItem);
