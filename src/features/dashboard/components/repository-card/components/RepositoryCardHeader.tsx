/**
 * =============================================================================
 * REPOSITORY CARD HEADER
 * =============================================================================
 *
 * Header section with avatar, project name, and GitHub link.
 */

"use client";

import { ExternalLink, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";

interface RepositoryCardHeaderProps {
  projectName: string;
  githubUrl: string;
  repoPath: string;
}

export function RepositoryCardHeader({
  projectName,
  githubUrl,
  repoPath,
}: RepositoryCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      {/* Left: Avatar + Info */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Avatar */}
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            "bg-gradient-to-br from-primary/20 to-violet-500/20",
            "text-primary font-bold text-lg shadow-lg shadow-primary/10",
            "transition-transform duration-300 group-hover:scale-110",
          )}
        >
          {projectName.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground text-lg group-hover:text-primary transition-colors">
            {projectName}
          </h3>
          <Link
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="truncate hover:underline">{repoPath}</span>
          </Link>
        </div>
      </div>

      {/* Right: Arrow */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          "bg-muted/50 group-hover:bg-primary/10 transition-all duration-300",
        )}
      >
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5" />
      </div>
    </div>
  );
}
