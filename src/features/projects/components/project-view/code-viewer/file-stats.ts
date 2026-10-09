/**
 * Code Viewer — instrument-strip presentation.
 *
 * The strip and the rail dots must be provably the same numbers. The
 * aggregation stays in `summarizeIndexedFiles`; this module only turns one
 * summary and the project's index facts into display strings. Formatting here
 * keeps JSX free of number logic and makes the E2E-sensitive raw caption
 * testable without rendering the viewer.
 */

import { formatBytes, formatCount, formatTokens } from "@/shared/lib/format";
import type { CoverageBands } from "../charts/coverage-meter";
import type { IndexedFileSummary } from "./utils";

export interface ViewerIndexProject {
  status: string;
  repoFileCount: number | null;
  estimatedTokens: number | null;
  progress?: number | null;
}

export interface ViewerStripPresentation {
  /** Raw `${stored} files`; deliberately never passed through formatCount. */
  storedCaption: string;
  /** Formatted `X of Y stored`; shown only when GitHub reported more. */
  secondaryCaption?: string;
  searchableCaption: string;
  skippedCaption: string;
  notIndexedCaption: string;
  bands: CoverageBands;
  linesCaption: string;
  bytesCaption: string;
  tokensCaption: string;
  statusDetail: string;
}

function clampProgress(progress: number | null | undefined): number | null {
  if (!Number.isFinite(progress)) return null;
  return Math.min(100, Math.max(0, Math.round(progress as number)));
}

export function statusDetailFor(status: string): string {
  switch (status) {
    case "processing":
      return "Indexing is running";
    case "pending":
      return "Indexing is queued";
    case "partial":
      return "Capped index: files beyond the run limit are not searchable";
    case "failed":
      return "The latest indexing run did not finish";
    case "completed":
      return "Index run complete";
    default:
      return "Index status unavailable";
  }
}

/**
 * Format the strip from one summary.
 *
 * The band counts come straight from the summary, so the meter cannot say
 * something different from the dots. Only the secondary caption may use
 * GitHub's repository-level count, and only to say how much ingestion stored.
 */
export function formatViewerStrip(
  summary: IndexedFileSummary,
  project: ViewerIndexProject,
): ViewerStripPresentation {
  const bands: CoverageBands = {
    embedded: summary.indexed,
    skipped: summary.skipped,
    unconsidered: summary.notIndexed,
  };
  const secondaryCaption =
    project.repoFileCount !== null &&
    Number.isFinite(project.repoFileCount) &&
    project.repoFileCount > summary.stored
      ? `${formatCount(summary.stored)} of ${formatCount(project.repoFileCount)} stored`
      : undefined;

  return {
    storedCaption: `${summary.stored} files`,
    secondaryCaption,
    searchableCaption: `${formatCount(summary.indexed)} searchable`,
    skippedCaption: `${formatCount(summary.skipped)} skipped`,
    notIndexedCaption: `${formatCount(summary.notIndexed)} not indexed`,
    bands,
    linesCaption: `${formatCount(summary.lines)} lines`,
    bytesCaption: formatBytes(summary.bytes),
    tokensCaption:
      project.estimatedTokens === null ? "—" : formatTokens(project.estimatedTokens),
    statusDetail: statusDetailFor(project.status),
  };
}

export { clampProgress };
