"use client";

/**
 * Search bar with sort dropdown for the project list.
 * All state is local — no data fetching, purely presentational + controlled.
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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2  z-20 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search projects..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className={cn(
            "w-full rounded-xl border border-border/60 bg-card/60 py-2.5 pl-10 pr-4",
            "text-sm text-foreground placeholder:text-muted-foreground/60",
            "backdrop-blur-sm transition-all duration-200",
            "focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20",
          )}
          aria-label="Search projects"
        />
      </div>

      {/* Sort + Count */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {resultCount} {resultCount === 1 ? "project" : "projects"}
        </span>

        <div className="relative">
          <ArrowUpDown className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select
            value={sortKey}
            onChange={(e) => onSortChange(e.target.value as ProjectSortKey)}
            className={cn(
              "appearance-none rounded-lg border border-border/60 bg-card/60",
              "py-2 pl-8 pr-8 text-sm text-foreground",
              "backdrop-blur-sm transition-all duration-200",
              "focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20",
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
    </div>
  );
}

export default memo(ProjectSearchBar);
