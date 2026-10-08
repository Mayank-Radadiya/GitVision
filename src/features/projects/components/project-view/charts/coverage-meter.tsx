"use client";

/**
 * CoverageMeter — the honest picture of what the AI can actually search.
 *
 * The previous widget printed `indexedFileCount / totalFileCount` as a bare
 * percentage string. That number alone cannot distinguish the two states a
 * project is genuinely in:
 *
 *   - `completed` — every file in the run is searchable
 *   - `partial`   — a working index over a *capped* subset; the run chose not to
 *                   embed the rest, which is a policy decision, not a defect
 *
 * Both can report 40%. Rendering one bar for both says the second one is broken
 * when it is not, so the meter splits into three bands — embedded, deliberately
 * skipped, and never considered — using the identity palette rather than the
 * primary colour that everything else on the page already wears.
 *
 * The progress of a run in flight is a fourth, separate thing: `embeddingProgress`
 * is how far the current run has got, which is not the same as coverage and does
 * not accumulate across runs.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatCount } from "@/shared/lib/format";

export interface CoverageBands {
  /** Files embedded and therefore searchable. */
  embedded: number;
  /** Files the run considered and then chose not to embed. */
  skipped: number;
  /** Files present in the repository that the run never looked at. */
  unconsidered: number;
}

interface CoverageMeterProps {
  bands: CoverageBands;
  /** 0–100 while a run is in flight; `null` otherwise. */
  progress?: number | null;
  className?: string;
  /** Legend under the bar. Off where the numbers are already spelled out. */
  showLegend?: boolean;
}

function bandWidth(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.max((value / total) * 100, value > 0 ? 0.5 : 0)}%`;
}

function CoverageMeter({
  bands,
  progress,
  className,
  showLegend = true,
}: CoverageMeterProps) {
  const total = bands.embedded + bands.skipped + bands.unconsidered;
  const coverage = total > 0 ? (bands.embedded / total) * 100 : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="bg-muted/60 relative h-2 overflow-hidden rounded-full"
        role="img"
        aria-label={
          total > 0
            ? `Index coverage: ${Math.round(coverage)}% — ${formatCount(
                bands.embedded,
              )} of ${formatCount(total)} files searchable${
                bands.skipped > 0
                  ? `, ${formatCount(bands.skipped)} deliberately skipped`
                  : ""
              }.`
            : "Index coverage: no files counted yet"
        }
      >
        {total > 0 && (
          <>
            <motion.span
              className="bg-gv-moss absolute inset-y-0 left-0 rounded-l-full"
              initial={{ width: 0 }}
              animate={{ width: bandWidth(bands.embedded, total) }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
            {bands.skipped > 0 && (
              <motion.span
                className="bg-gv-amber absolute inset-y-0"
                initial={{ width: 0 }}
                animate={{ width: bandWidth(bands.skipped, total) }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  left: bandWidth(bands.embedded, total),
                }}
              />
            )}
          </>
        )}
      </div>

      {progress !== null && progress !== undefined && progress < 100 && (
        <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
          <div className="bg-muted/60 h-1 flex-1 overflow-hidden rounded-full">
            <motion.div
              className="bg-gv-wire h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(progress, 2)}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="font-mono tabular-nums">{progress}%</span>
        </div>
      )}

      {showLegend && total > 0 && (
        <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          <LegendItem
            swatch="bg-gv-moss"
            label="Searchable"
            value={bands.embedded}
          />
          {bands.skipped > 0 && (
            <LegendItem
              swatch="bg-gv-amber"
              label="Skipped"
              value={bands.skipped}
            />
          )}
          {bands.unconsidered > 0 && (
            <LegendItem
              swatch="bg-muted-foreground/25"
              label="Not considered"
              value={bands.unconsidered}
            />
          )}
        </dl>
      )}
    </div>
  );
}

function LegendItem({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="flex items-center gap-1.5">
        <span
          className={cn("size-2 shrink-0 rounded-full", swatch)}
          aria-hidden="true"
        />
        {label}
      </dt>
      <dd className="font-mono font-medium tabular-nums text-foreground">
        {formatCount(value)}
      </dd>
    </div>
  );
}

export { CoverageMeter };
export default memo(CoverageMeter);