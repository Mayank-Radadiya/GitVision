/**
 * =============================================================================
 * REPOSITORY CARD FOOTER
 * =============================================================================
 *
 * Footer section with branch count and creation date.
 */

"use client";

import { Clock } from "lucide-react";

interface RepositoryCardFooterProps {
  totalBranches: number;
  formattedDate: string;
}

export function RepositoryCardFooter({
  totalBranches,
  formattedDate,
}: RepositoryCardFooterProps) {
  return (
    <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
      <span className="text-xs text-muted-foreground/60">
        {totalBranches} branches
      </span>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Created {formattedDate}</span>
      </div>
    </div>
  );
}
