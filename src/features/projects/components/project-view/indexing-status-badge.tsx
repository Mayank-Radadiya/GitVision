"use client";

import { Badge } from "@/src/shared/components/ui/badge";

interface IndexingStatusBadgeProps {
  embeddingStatus: string | null | undefined;
  /** File count GitHub reported at import time — a fallback denominator. */
  totalFiles?: number | null;
  /** Files embedded by the current run, written by the pipeline. */
  indexedFileCount?: number | null;
  /** Files the current run considered, written by the pipeline. */
  totalFileCount?: number | null;
}

export function IndexingStatusBadge({
  embeddingStatus,
  totalFiles,
  indexedFileCount,
  totalFileCount,
}: IndexingStatusBadgeProps) {
  if (embeddingStatus === "partial") {
    // Prefer the pipeline's own counts. They are authoritative; `totalFiles` is
    // only a last resort for a row written before the counters existed.
    const total = totalFileCount || totalFiles;
    const indexed = indexedFileCount || 0;

    return (
      <Badge
        variant="outline"
        className="border-amber-500/50 text-amber-600 dark:text-amber-400 gap-1.5"
      >
        {total ? (
          <>
            Partial index — indexed {indexed} of {total} files
          </>
        ) : (
          <>Partial index — some files not indexed</>
        )}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 gap-1.5"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      AI Synced
    </Badge>
  );
}
