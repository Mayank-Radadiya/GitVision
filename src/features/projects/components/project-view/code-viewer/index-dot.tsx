/**
 * Code Viewer — index dot.
 *
 * One non-interactive status dot per rail row. It is always paired with an
 * accessible name on the row itself, so the dot is hidden from assistive
 * technology and never the only encoding of index state.
 */

import { memo } from "react";
import { describeFileIndex, type FileIndexState } from "@/src/lib/file-index-state";
import { cn } from "@/shared/lib/utils";
import type { DirectoryIndexState } from "./utils";

interface IndexDotProps {
  state: FileIndexState | DirectoryIndexState;
  chunks?: number;
  tokens?: number;
  status: string;
  /** Aggregate directory dots render quieter than file dots. */
  dimmed?: boolean;
  /** Overrides the tooltip: directories aggregate files, so the per-file
   *  detail copy would misdescribe them. */
  title?: string;
  className?: string;
}

export function indexDotTone(state: FileIndexState | DirectoryIndexState): string {
  switch (state) {
    case "indexed":
      return "bg-gv-moss";
    case "skipped":
      return "bg-gv-amber";
    case "not-indexed":
      return "bg-muted-foreground/30";
    default:
      return "bg-muted-foreground/20";
  }
}

function IndexDot({
  state,
  chunks = 0,
  tokens = 0,
  status,
  dimmed = false,
  title,
  className,
}: IndexDotProps) {
  // A mixed directory has no single truthful state, so it gets no dot.
  if (state === "unresolved") return null;

  const description = describeFileIndex({ chunkCount: chunks, tokenCount: tokens, status });

  return (
    <span
      aria-hidden="true"
      title={title ?? description.detail}
      data-index-state={state}
      className={cn(
        "size-2 shrink-0 rounded-full",
        indexDotTone(state),
        dimmed && "opacity-70",
        className,
      )}
    />
  );
}

export default memo(IndexDot);
