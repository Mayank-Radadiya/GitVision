"use client";

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
import {
  formatCount,
  formatRelativeShort,
  formatTokens,
} from "@/shared/lib/format";
import { useNow } from "./use-now";
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

/**
 * What one indexed unit actually costs.
 *
 * `index.chunks` and `index.tokens` were two integers sharing a single metric
 * tile labelled "Index footprint", which answered neither question a reader has:
 * *how much is indexed* was already the coverage meter's job, and *how big is each
 * piece* was invisible. Splitting the ratio out makes the chunker legible — a
 * tokens-per-chunk figure an order of magnitude above the usual band means files
 * were not being split, and a very low one means the opposite waste.
 *
 * Returns `null` whenever the ratio would be undefined or meaningless. A `null` is
 * not rendered as `0` or `—`: the row is omitted instead, because an empty pair of
 * figures reads as "we measured this and it was zero".
 */
export function describeIndexEconomy(input: {
  chunks?: number | null;
  tokens?: number | null;
  indexedFiles?: number | null;
}): { tokensPerChunk: number; chunksPerFile: number | null } | null {
  const chunks = input.chunks ?? 0;
  const tokens = input.tokens ?? 0;
  if (!(chunks > 0) || !(tokens > 0)) return null;
  const indexedFiles = input.indexedFiles ?? 0;
  return {
    tokensPerChunk: Math.round(tokens / chunks),
    // Chunks-per-file is the chunker's packing density — how finely a file was
    // split. It was briefly written the other way round, as files-per-chunk,
    // which is the wrong way to read a real index: a 1,255-token chunker puts
    // roughly forty chunks in one file, so files-per-chunk is ~0.03 and renders
    // as a flat "0.0" on every project that is actually indexed properly. The
    // null is "no file count known", which is a different fact from zero.
    chunksPerFile: indexedFiles > 0 ? chunks / indexedFiles : null,
  };
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
  /** Index footprint, from the insights aggregate rather than the project row. */
  chunks?: number | null;
  tokens?: number | null;
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
  chunks,
  tokens,
  isLoading,
}: IndexHealthProps) {
  const now = useNow();
  if (isLoading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }

  const embedded = Math.max(0, indexedFileCount ?? 0);
  const skipped = Math.max((totalFileCount ?? 0) - embedded, 0);
  const unconsidered = Math.max(
    (totalFiles ?? 0) - Math.max(totalFileCount ?? 0, embedded),
    0,
  );
  const total = embedded + skipped + unconsidered;
  const coverage = total > 0 ? (embedded / total) * 100 : null;
  const health = describeIndexHealth(status, {
    embedded,
    skipped,
    unconsidered,
  });
  const tone = TONE_CLASS[health.tone];
  const inFlight = isIndexingInFlight(status ?? "pending");
  const economy = describeIndexEconomy({
    chunks,
    tokens,
    indexedFiles: embedded,
  });

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {coverage === null
            ? "—"
            : `${coverage.toFixed(coverage < 100 && coverage > 0 ? 1 : 0)}%`}
        </span>
        <span className="text-muted-foreground text-[11px]">
          searchable coverage
        </span>
      </div>
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
        {lastEmbeddingAttempt && !inFlight && now && (
          <span className="text-muted-foreground text-xs">
            Last run {formatRelativeShort(lastEmbeddingAttempt, now)}
          </span>
        )}
      </div>

      <p className="text-foreground text-xs leading-relaxed">
        {health.headline}
      </p>

      <CoverageMeter
        bands={{ embedded, skipped, unconsidered }}
        progress={inFlight ? (embeddingProgress ?? 0) : null}
      />

      {/* Only rendered once there is a real index to divide. An empty ratio row
          would read as "measured, and the answer is nothing". */}
      {economy && (
        <details className="group border-border/60 border-t pt-3">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-[11px] transition-colors">
            Index details · {formatCount(chunks ?? 0)} chunks
          </summary>
          <dl className="mt-3 grid gap-2 text-[11px]">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">Tokens per chunk</dt>
              <dd className="text-foreground font-semibold tabular-nums">
                {formatCount(economy.tokensPerChunk)}
              </dd>
            </div>
            {economy.chunksPerFile !== null && (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">Chunks per file</dt>
                <dd className="text-foreground font-semibold tabular-nums">
                  {economy.chunksPerFile.toFixed(1)}
                </dd>
              </div>
            )}
            <div className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">Indexed tokens</dt>
              <dd className="text-foreground font-semibold tabular-nums">
                {formatTokens(tokens ?? 0)}
              </dd>
            </div>
          </dl>
        </details>
      )}

      {/* `embeddingError` is populated only on `failed`, and it is the only place
          the actual reason reaches the user — the generic headline above says
          that the index is unusable but not why. */}
      {(status === "failed" || status === "partial") && embeddingError && (
        <p
          className={`rounded-md border px-2.5 py-2 text-xs leading-relaxed break-words ${status === "failed" ? "text-gv-ember bg-gv-ember/5 border-gv-ember/20" : "text-muted-foreground border-border bg-muted/30"}`}
        >
          {embeddingError}
        </p>
      )}
    </div>
  );
}

export { IndexHealth };
export default memo(IndexHealth);
