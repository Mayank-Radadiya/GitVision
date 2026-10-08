"use client";

/**
 * Index health — the one sentence that says whether this project can be asked
 * anything useful.
 *
 * This leads the overview because it is the product's actual precondition. A
 * repo at `failed` answers every question wrongly; a repo at `partial` answers
 * them about a subset and says so. Everything else on this page is commentary on
 * those two facts.
 *
 * The mapping from `embeddingStatus` to wording lives in `describeIndexHealth`
 * below, exported and pure, so the five states are testable without rendering
 * anything and cannot drift apart between this component and the tone it paints.
 */

import { memo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  MinusCircle,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isIndexingInFlight } from "@/src/lib/indexing-status";
import { formatCount, formatRelativeShort } from "@/shared/lib/format";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { CoverageMeter } from "../charts/coverage-meter";

/** The three tones the page paints with, mapped to the identity palette. */
export type HealthTone = "ready" | "working" | "warning" | "critical" | "idle";

export interface IndexHealthCopy {
  tone: HealthTone;
  /** Short pill label. */
  label: string;
  /** The full sentence, which is the point of the section. */
  headline: string;
  icon: LucideIcon;
}

const TONE_CLASS: Record<HealthTone, { text: string; dot: string }> = {
  ready: { text: "text-gv-moss", dot: "bg-gv-moss" },
  working: { text: "text-gv-wire", dot: "bg-gv-wire" },
  warning: { text: "text-gv-amber", dot: "bg-gv-amber" },
  critical: { text: "text-gv-ember", dot: "bg-gv-ember" },
  idle: { text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

/**
 * Wording for each `embedding_status`.
 *
 * `partial` is the case worth reading twice: `indexing-status.ts` defines it as
 * a working index over a capped subset, explicitly not a failure. An earlier
 * version of this file's neighbour rendered it in the same red as `failed`, which
 * told users to re-sync a project that was fine.
 *
 * An unrecognised status resolves to `idle` rather than throwing. The column is a
 * bare `varchar` — `db/` cannot import `src/lib/`, so nothing enforces the
 * CHECK constraint at the type level — and a new status should degrade to "no
 * news" rather than blank the page.
 */
export function describeIndexHealth(
  status: string | null | undefined,
  counts: { embedded: number; skipped: number; unconsidered: number },
): IndexHealthCopy {
  const { embedded, skipped, unconsidered } = counts;
  const total = embedded + skipped + unconsidered;
  const searchable =
    total > 0
      ? `${formatCount(embedded)} of ${formatCount(total)} files`
      : "no files counted";

  switch (status) {
    case "completed":
      return {
        tone: "ready",
        label: "Ready",
        headline: `Every considered file is searchable — ${searchable}.`,
        icon: CheckCircle2,
      };
    case "partial":
      return {
        tone: "warning",
        label: "Partial",
        headline: `Searchable over ${searchable}; ${formatCount(
          skipped,
        )} left out of the run and ${formatCount(
          unconsidered,
        )} never considered.`,
        icon: MinusCircle,
      };
    case "processing":
      return {
        tone: "working",
        label: "Indexing",
        headline: `Embedding in progress — ${searchable} searchable so far.`,
        icon: Loader2,
      };
    case "pending":
      return {
        tone: "working",
        label: "Queued",
        headline: "Indexing has not started yet. It runs in the background.",
        icon: CircleDashed,
      };
    case "failed":
      return {
        tone: "critical",
        label: "Failed",
        headline:
          "No searchable index. Answers about this repository would be unreliable.",
        icon: AlertTriangle,
      };
    default:
      return {
        tone: "idle",
        label: "Unknown",
        headline: "This project has no index status yet.",
        icon: ShieldCheck,
      };
  }
}

interface IndexHealthProps {
  status?: string | null;
  indexedFileCount?: number | null;
  totalFileCount?: number | null;
  /** Files in the repository, from GitHub at import. */
  totalFiles?: number | null;
  embeddingProgress?: number | null;
  embeddingError?: string | null;
  lastEmbeddingAttempt?: Date | string | null;
  isLoading?: boolean;
}

function IndexHealth({
  status,
  indexedFileCount,
  totalFileCount,
  totalFiles,
  embeddingProgress,
  embeddingError,
  lastEmbeddingAttempt,
  isLoading,
}: IndexHealthProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }

  const embedded = indexedFileCount ?? 0;
  const skipped = Math.max((totalFileCount ?? 0) - embedded, 0);
  const unconsidered = Math.max((totalFiles ?? 0) - (totalFileCount ?? 0), 0);
  const health = describeIndexHealth(status, { embedded, skipped, unconsidered });
  const tone = TONE_CLASS[health.tone];
  const inFlight = isIndexingInFlight(status ?? "pending");

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-current/20 px-2 py-0.5 text-xs font-medium ${tone.text}`}
        >
          <span className="relative flex size-1.5">
            {inFlight && (
              <span
                className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${tone.dot}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative inline-flex size-1.5 rounded-full ${tone.dot}`}
            />
          </span>
          {health.label}
        </span>
        {lastEmbeddingAttempt && !inFlight && (
          <span className="text-muted-foreground text-xs">
            Last run {formatRelativeShort(lastEmbeddingAttempt)}
          </span>
        )}
      </div>

      <p className="text-foreground text-sm leading-relaxed font-medium">
        {health.headline}
      </p>

      <CoverageMeter
        bands={{ embedded, skipped, unconsidered }}
        progress={inFlight ? (embeddingProgress ?? 0) : null}
      />

      {/* `embeddingError` is populated only on `failed`, and it is the only place
          the actual reason reaches the user — the generic headline above says
          that the index is unusable but not why. */}
      {status === "failed" && embeddingError && (
        <p className="text-gv-ember bg-gv-ember/5 border-gv-ember/20 line-clamp-3 rounded-md border px-2.5 py-1.5 text-xs">
          {embeddingError}
        </p>
      )}
    </div>
  );
}

export { IndexHealth };
export default memo(IndexHealth);
