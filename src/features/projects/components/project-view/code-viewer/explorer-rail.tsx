"use client";

/**
 * Code Viewer — explorer rail.
 *
 * The old rail opened with an "EXPLORER" caption, which told the reader
 * nothing they could not already see from the tree below it, and cost a whole
 * row of vertical space. The space it used to hold now carries the sidebar
 * toggle and a ⌘K affordance that makes the palette discoverable to people who
 * will never read a shortcut sheet.
 *
 * Everything else here was already right and is preserved verbatim: the search
 * input, the three filter chips with live counts, and the WAI-ARIA tree. Those
 * chips carry an index-state vocabulary the tests pin, so the labels are not
 * reworded for looks.
 */

import { memo, type RefObject } from "react";
import { PanelLeftClose, Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import FileTree from "./file-tree";
import type { TreeNode } from "./utils";

export type ViewerIndexFilter = "all" | "searchable" | "not-indexed";

interface ExplorerRailProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: ViewerIndexFilter;
  onFilterChange: (filter: ViewerIndexFilter) => void;
  counts: { all: number; searchable: number; notIndexed: number };
  /** Matches for the current query/filter; empty means "no match", not "no data". */
  tree: TreeNode[];
  visibleCount: number;
  totalCount: number;
  selectedPath: string;
  onSelectFile: (path: string) => void;
  onClose: () => void;
  onOpenPalette: () => void;
  /** Project embedding status, threaded into the tree for dot titles. */
  indexStatus: string;
  /**
   * Target for the `/` shortcut. Held by the viewer rather than by this
   * component because the binding is a viewer contract, not a rail concern.
   */
  searchRef?: RefObject<HTMLInputElement | null>;
}

const FILTER_CHIPS: { id: ViewerIndexFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "searchable", label: "Searchable" },
  { id: "not-indexed", label: "Not indexed" },
];

function ExplorerRail({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
  tree,
  visibleCount,
  totalCount,
  selectedPath,
  onSelectFile,
  onClose,
  onOpenPalette,
  indexStatus,
  searchRef,
}: ExplorerRailProps) {
  const hasResult = visibleCount > 0;

  /** The "not-indexed" chip id is the UI vocabulary; the count key is not. */
  const chipCount = (id: ViewerIndexFilter): number =>
    counts[id === "not-indexed" ? "notIndexed" : id];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ─── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide file explorer"
          title="Hide explorer (⌘B)"
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer rounded-md p-1.5 transition-colors outline-none",
            "focus-visible:ring-ring/70 focus-visible:ring-2 focus-visible:ring-inset",
          )}
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="sr-only">File explorer</span>
        <button
          type="button"
          onClick={onOpenPalette}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent/50 ms-auto flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors outline-none",
            "focus-visible:ring-ring/70 focus-visible:ring-2 focus-visible:ring-inset",
          )}
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Search files</span>
          <kbd className="border-border/60 bg-muted/60 hidden rounded border px-1 py-px font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ─── Filter ───────────────────────────────────────────────────── */}
      <div className="shrink-0 px-2 pt-2">
        <Input
          ref={searchRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter by path…"
          aria-label="Filter files by path"
          className="h-8 text-xs"
        />
        <div
          role="group"
          aria-label="Filter files by index state"
          className="mt-2 flex items-center gap-1"
        >
          {FILTER_CHIPS.map((chip) => {
            const isActive = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange(chip.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors outline-none",
                  "focus-visible:ring-ring/70 focus-visible:ring-2 focus-visible:ring-inset",
                  isActive
                    ? "border-border/60 bg-accent/60 text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {chip.label}
                <span
                  className={cn(
                    "font-mono text-[10px] tabular-nums",
                    isActive ? "text-muted-foreground" : "text-muted-foreground/70",
                  )}
                >
                  {chipCount(chip.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tree ─────────────────────────────────────────────────────── */}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1">
        {hasResult ? (
          <FileTree
            tree={tree}
            selectedPath={selectedPath}
            onSelect={onSelectFile}
            indexStatus={indexStatus}
          />
        ) : (
          <div className="px-2 py-3">
            <p className="text-muted-foreground text-xs">
              {query
                ? `Nothing matches "${query}"`
                : filter === "searchable"
                  ? "No searchable files in this index."
                  : filter === "not-indexed"
                    ? "Every stored file is searchable."
                    : "No files stored for this project yet."}
            </p>
            <p className="text-muted-foreground/80 mt-1 text-[11px]">
              {query
                ? "Try a shorter fragment, or clear the filter."
                : "Files are stored during ingestion; large, binary, and dependency files are skipped."}
            </p>
          </div>
        )}
      </div>

      {/* ─── Footer count ─────────────────────────────────────────────── */}
      {visibleCount > 0 && (
        <div
          aria-label={`${visibleCount} of ${totalCount} files shown`}
          className="text-muted-foreground/70 shrink-0 border-t px-3 py-1.5 font-mono text-[10px] tabular-nums"
        >
          {visibleCount === totalCount
            ? `${totalCount} shown`
            : `${visibleCount}/${totalCount} shown`}
        </div>
      )}
    </div>
  );
}

export default memo(ExplorerRail);
