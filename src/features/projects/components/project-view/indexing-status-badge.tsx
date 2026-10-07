"use client";

import { Badge } from "@/shared/components/ui/badge";
import { Loader2 } from "lucide-react";

interface IndexingStatusBadgeProps {
  embeddingStatus: string | null | undefined;
  totalFiles?: number | null;
  indexedFileCount?: number | null;
  totalFileCount?: number | null;
}

export function IndexingStatusBadge({
  embeddingStatus,
  totalFiles,
  indexedFileCount,
  totalFileCount,
}: IndexingStatusBadgeProps) {
  const waiting =
    embeddingStatus === "pending" || embeddingStatus === "processing";
  const total = totalFileCount || totalFiles;
  const label =
    embeddingStatus === "completed"
      ? "AI ready"
      : embeddingStatus === "partial"
        ? total
          ? `Partial index — indexed ${indexedFileCount ?? 0} of ${total} files`
          : "Partial index — some files not indexed"
        : embeddingStatus === "failed"
          ? "Indexing failed"
          : embeddingStatus === "processing"
            ? "Indexing"
            : embeddingStatus === "pending"
              ? "Queued for indexing"
              : "Index status unavailable";
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${embeddingStatus === "failed" ? "border-destructive/30 text-destructive" : "border-border bg-muted/40 text-foreground"}`}
    >
      {waiting ? (
        <Loader2
          className="size-3 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <span
          className={`size-1.5 rounded-full ${embeddingStatus === "failed" ? "bg-destructive" : embeddingStatus === "completed" ? "bg-primary" : "bg-muted-foreground"}`}
          aria-hidden="true"
        />
      )}
      {label}
    </Badge>
  );
}
