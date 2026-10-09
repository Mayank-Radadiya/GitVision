"use client";

/**
 * Code Viewer — FileFinder.
 *
 * Command-first file jump: a combobox input ranking the flat indexed-file
 * list through the shared fuzzy matcher, capped at 30 rows. Empty query
 * shows no dropdown; a query with no hits echoes itself with a clear.
 */

import { memo, useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { filterViewerFiles, type FileEntry } from "./utils";

const MAX_RESULTS = 30;

interface FileFinderProps {
  files: readonly FileEntry[];
  query: string;
  onQuery: (query: string) => void;
  onSelect: (path: string) => void;
  placeholder?: string;
  /** Input id so the viewer can focus the finder from a keyboard shortcut. */
  id?: string;
}

function FileFinder({
  files,
  query,
  onQuery,
  onSelect,
  placeholder = "Go to file…",
  id,
}: FileFinderProps) {
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(
    () => (query.trim() ? filterViewerFiles(files, query).slice(0, MAX_RESULTS) : []),
    [files, query],
  );
  const open = query.trim().length > 0;
  const activeId = results.length > 0 ? `${listboxId}-${activeIndex % results.length}` : undefined;

  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        role="combobox"
        id={id}
        aria-label="Go to file"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          setActiveIndex(0);
          onQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && results.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % results.length);
          } else if (event.key === "ArrowUp" && results.length > 0) {
            event.preventDefault();
            setActiveIndex(
              (index) => (index - 1 + results.length) % results.length,
            );
          } else if (event.key === "Enter" && results.length > 0) {
            event.preventDefault();
            const top = results[activeIndex % results.length];
            if (top) onSelect(top.path);
          } else if (event.key === "Escape") {
            onQuery("");
          }
        }}
        className="pl-9"
      />
      {open && (
        <div className="border-border/60 bg-popover absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-md border shadow-md">
          {results.length === 0 ? (
            <div role="listbox" id={listboxId} className="max-h-72 overflow-y-auto p-1">
              <div role="option" aria-selected="false" className="text-muted-foreground px-2 py-2 text-sm">
                No files match “{query.trim()}”.
              </div>
            </div>
          ) : (
            <ul role="listbox" id={listboxId} aria-label="Matching files" className="max-h-72 overflow-y-auto p-1">
              {results.map((file, index) => {
                const id = `${listboxId}-${index}`;
                const isActive = index === activeIndex % results.length;
                return (
                  <li
                    key={file.id || file.path}
                    id={id}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => onSelect(file.path)}
                    className={
                      isActive
                        ? "bg-accent text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                        : "text-muted-foreground hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                    }
                  >
                    <span className="truncate font-mono text-[13px]">{file.path}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(FileFinder);
