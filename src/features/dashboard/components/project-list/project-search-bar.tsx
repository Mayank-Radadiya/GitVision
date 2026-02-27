"use client";

/**
 * Search bar with sort for the project list.
 * Borderless input with focus ring, minimal sort indicator.
 */

import { memo } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { SORT_OPTIONS } from "@/features/dashboard/constants/dashboard.constants";
import type { ProjectSortKey } from "@/features/dashboard/types/dashboard.types";

interface ProjectSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  sortKey: ProjectSortKey;
  onSortChange: (key: ProjectSortKey) => void;
  resultCount: number;
}

function ProjectSearchBar({
  query,
  onQueryChange,
  sortKey,
  onSortChange,
  resultCount,
}: ProjectSearchBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Input */}
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 z-20 text-muted-foreground/50" />
        <input
          type="text"
          placeholder={`Search ${resultCount} projects...`}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className={cn(
            "w-full rounded-lg border-0 bg-muted/30 py-2 pl-10 pr-4",
            "text-sm text-foreground placeholder:text-muted-foreground/40",
            "transition-all duration-200",
            "focus:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30",
          )}
          aria-label="Search projects"
        />
      </div>

      {/* Sort */}
      <div className="relative">
        <ArrowUpDown className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as ProjectSortKey)}
          className={cn(
            "appearance-none rounded-lg border-0 bg-muted/30",
            "py-2 pl-8 pr-8 text-xs text-muted-foreground",
            "transition-all duration-200",
            "focus:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30",
            "cursor-pointer",
          )}
          aria-label="Sort projects"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default memo(ProjectSearchBar);
