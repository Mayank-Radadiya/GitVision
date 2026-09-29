"use client";

import { AlertTriangle, Wifi } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";

const INDEXED_COUNTS = /^Indexed (\d+) of (\d+) files/;

export function parseIndexedCounts(embeddingError: string | null | undefined) {
  const match = INDEXED_COUNTS.exec(embeddingError ?? "");
  if (!match) return null;
  return { indexed: Number(match[1]), total: Number(match[2]) };
}

interface IndexingStatusBadgeProps {
  embeddingStatus: string | null | undefined;
  totalFiles: number | null | undefined;
  embeddingError: string | null | undefined;
}

export function IndexingStatusBadge({
  embeddingStatus,
  totalFiles,
  embeddingError,
}: IndexingStatusBadgeProps) {
  if (embeddingStatus === "partial") {
    const counts = parseIndexedCounts(embeddingError);
    const label = counts
      ? `Partial index — indexed ${counts.indexed} of ${counts.total} files`
      : `Partial index — ${totalFiles ?? "some"} files not indexed`;

    return (
      <Badge
        variant="outline"
        className="h-6 w-fit gap-1.5 border-amber-500/30 bg-amber-500/10 px-2 text-[11px] text-amber-400"
      >
        <AlertTriangle className="h-3 w-3" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="h-6 w-fit gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] text-emerald-400"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      <Wifi className="h-3 w-3" />
      AI Synced
    </Badge>
  );
}
