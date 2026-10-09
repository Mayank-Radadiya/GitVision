"use client";

/**
 * Code Viewer — instrument strip (status line).
 *
 * This was a card: a caption, a meter, and a four-figure definition list
 * stacked in a bordered panel. As a card it cost roughly 110px above the code
 * pane's bottom edge and duplicated, in prose, everything the insights drawer
 * already shows properly. As a status line it costs one 36px row and still
 * carries the two things that must always be visible:
 *
 *   1. **The raw stored-file caption**, which is the single element matching
 *      the text used by the ingestion E2E. It is never passed through a
 *      formatter, and exactly one element in this tree may carry it.
 *   2. **The index state of the project**, because "why can't I ask about
 *      anything" should be answerable without opening anything.
 *
 * The sums stay in collapsed `<span title>` attributes rather than being
 * dropped: they are the cheapest possible answer to "how big is this index".
 */

import { memo } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { formatCount, formatTokens } from "@/shared/lib/format";
import { CoverageMeter } from "../charts/coverage-meter";
import {
  clampProgress,
  type ViewerStripPresentation,
} from "./file-stats";
import type { IndexedFileSummary } from "./utils";

interface InstrumentStripProps {
  strip: ViewerStripPresentation;
  summary: IndexedFileSummary;
  /** 0–100 while a run is in flight; null when idle. */
  progress?: number | null;
  onShowInsights: () => void;
  className?: string;
}

function InstrumentStrip({
  strip,
  summary,
  progress = null,
  onShowInsights,
  className,
}: InstrumentStripProps) {
  const shownProgress = clampProgress(progress);

  return (
    <section
      aria-label="Index retrieval facts"
      className={cn(
        "border-border/60 bg-card flex shrink-0 items-center gap-3 border-t px-3 py-1.5",
        className,
      )}
    >
      <p className="text-foreground shrink-0 text-xs font-semibold">
        <span>{strip.storedCaption}</span>
        {strip.secondaryCaption && (
          <span className="text-muted-foreground ms-2 text-[11px] font-normal">
            {strip.secondaryCaption}
          </span>
        )}
      </p>

      <span className="text-muted-foreground/40 hidden shrink-0 text-xs" aria-hidden="true">
        ·
      </span>
      <p className="hidden shrink-0 items-baseline gap-1.5 text-[11px] sm:flex">
        <span className="text-gv-moss font-medium">{summary.indexed}</span>
        <span className="text-muted-foreground/60">searchable</span>
        {summary.skipped > 0 && (
          <>
            <span className="text-muted-foreground/40" aria-hidden="true">
              ·
            </span>
            <span className="text-gv-amber font-medium">{summary.skipped}</span>
            <span className="text-muted-foreground/60">skipped</span>
          </>
        )}
        {summary.notIndexed > 0 && (
          <>
            <span className="text-muted-foreground/40" aria-hidden="true">
              ·
            </span>
            <span className="text-muted-foreground font-medium">
              {summary.notIndexed}
            </span>
            <span className="text-muted-foreground/60">not indexed</span>
          </>
        )}
      </p>

      <div className="hidden min-w-0 max-w-40 flex-1 lg:block">
        <CoverageMeter
          bands={strip.bands}
          progress={shownProgress}
          showLegend={false}
        />
      </div>

      <dl className="text-muted-foreground ms-auto hidden shrink-0 items-baseline gap-3 text-[11px] md:flex">
        <div className="flex items-baseline gap-1">
          <dt className="sr-only">Total lines</dt>
          <dd className="font-mono tabular-nums" title="Stored lines across all files">
            {formatCount(summary.lines)}
          </dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="sr-only">Total size</dt>
          <dd className="font-mono tabular-nums" title="Stored size across all files">
            {strip.bytesCaption}
          </dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="sr-only">Total tokens</dt>
          <dd
            className="font-mono tabular-nums"
            title={`${formatTokens(summary.tokens)} across ${formatCount(summary.chunks)} chunks`}
          >
            {formatTokens(summary.tokens)}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onShowInsights}
        className="text-muted-foreground hover:text-foreground hover:bg-accent/50 ms-auto flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors outline-none focus-visible:ring-ring/70 focus-visible:ring-2 md:ms-0"
      >
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        <span className="hidden sm:inline">Insights</span>
      </button>
    </section>
  );
}

export default memo(InstrumentStrip);
