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
        <Search className="text-muted-foreground/50 absolute top-1/2 left-3 z-20 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          placeholder={`Search ${resultCount} projects...`}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className={cn(
            "bg-muted/30 w-full rounded-lg border-0 py-2 pr-4 pl-10",
            "text-foreground placeholder:text-muted-foreground/40 text-sm",
            "transition-all duration-200",
            "focus:bg-muted/50 focus:ring-primary/30 focus:ring-1 focus:outline-none",
          )}
          aria-label="Search projects"
        />
      </div>

      {/* Sort */}
      <div className="relative">
        <ArrowUpDown className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as ProjectSortKey)}
          className={cn(
            "bg-muted/30 appearance-none rounded-lg border-0",
            "text-muted-foreground py-2 pr-8 pl-8 text-xs",
            "transition-all duration-200",
            "focus:bg-muted/50 focus:ring-primary/30 focus:ring-1 focus:outline-none",
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
