"use client";

/**
 * Code Viewer — command bar.
 *
 * One row that does the work the old panel spread across three: it was a
 * breadcrumb nav, then a facts row, then a tab strip, so a reader scrolled
 * past roughly 90px of chrome before the first line of code.
 *
 * The hierarchy is deliberate. Left is *where am I* — the path, with every
 * folder segment a control that narrows the explorer. Centre is *what is this
 * file* — the four figures a reader actually uses, in mono with tabular
 * numerals so the columns do not jitter as they change. Right is *what can I
 * do* — only the actions worth permanent space; everything else is in
 * `file-actions`.
 *
 * Nothing in the centre column is decorative: each figure is either something
 * the reader cannot infer (bytes, chunks) or something they came for (lines,
 * searchability). A figure that carried no information was removed rather than
 * restyled.
 */

import { memo, useMemo, type ReactNode } from "react";
import { ChevronRight, MessageSquare, PanelRight, PanelRightClose } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { formatBytes, formatCount, formatTokens } from "@/shared/lib/format";
import type { FileIndexState } from "@/src/lib/file-index-state";
import IndexDot from "./index-dot";

export interface FileFacts {
  lines: number;
  bytes: number;
  chunks: number;
  tokens: number;
  indexState: FileIndexState;
  /** Project embedding status — explains zero-chunk files. */
  status: string;
}

interface CodeCommandBarProps {
  filePath: string;
  facts: FileFacts;
  /** Human label for the file's index state, from `describeFileIndex`. */
  indexLabel: string;
  /** Why asking is unavailable, or null when it is allowed. */
  askDisabledReason: string | null;
  isAskPending: boolean;
  onAsk: () => void;
  onSelectFolder: (prefix: string) => void;
  insightsOpen: boolean;
  onToggleInsights: () => void;
  /** The overflow menu, supplied so this row stays presentational. */
  actions: ReactNode;
}

interface BreadcrumbSegment {
  name: string;
  /** Null for the file itself; a folder prefix for every directory. */
  prefix: string | null;
}

const FIGURE_CLASS = "text-muted-foreground font-mono text-[11px] tabular-nums";

function CodeCommandBar({
  filePath,
  facts,
  indexLabel,
  askDisabledReason,
  isAskPending,
  onAsk,
  onSelectFolder,
  insightsOpen,
  onToggleInsights,
  actions,
}: CodeCommandBarProps) {
  // Breadcrumb segments: every folder narrows the explorer, the file is current.
  const breadcrumb = useMemo<BreadcrumbSegment[]>(() => {
    const parts = filePath.split("/").filter(Boolean);
    const segments: BreadcrumbSegment[] = [];
    let prefix = "";
    parts.forEach((part, index) => {
      if (index < parts.length - 1) {
        prefix += `/${part}`;
        segments.push({ name: part, prefix: `${prefix}/` });
      } else {
        segments.push({ name: part, prefix: null });
      }
    });
    return segments;
  }, [filePath]);

  return (
    <div
      className={cn(
        "border-border/60 bg-card flex min-w-0 items-center gap-2 border-b px-2 py-1.5",
      )}
    >
      {/* ─── Where am I ─────────────────────────────────────────────────── */}
      <nav
        aria-label="File location"
        className="flex min-w-0 flex-1 items-center gap-0.5"
      >
        {breadcrumb.map((segment, index) =>
          segment.prefix === null ? (
            <span
              key={segment.name}
              aria-current="page"
              className="text-foreground min-w-0 truncate text-[13px] font-medium"
            >
              {segment.name}
            </span>
          ) : (
            <span
              key={segment.name}
              className="flex shrink-0 items-center gap-0.5"
            >
              <button
                type="button"
                onClick={() => onSelectFolder(segment.prefix as string)}
                title={`Show ${segment.prefix} in the explorer`}
                className="text-muted-foreground hover:text-foreground cursor-pointer truncate rounded px-1 py-0.5 text-[13px] transition-colors outline-none focus-visible:ring-ring/70 focus-visible:ring-2 focus-visible:ring-inset"
              >
                {segment.name}
              </button>
              <ChevronRight
                className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {index === 0 && <span className="sr-only">in project root</span>}
            </span>
          ),
        )}
      </nav>

      {/* ─── What is this file ──────────────────────────────────────────── */}
      <dl className="hidden shrink-0 items-center gap-2.5 lg:flex">
        <div className="flex items-center gap-1.5">
          <IndexDot
            state={facts.indexState}
            chunks={facts.chunks}
            tokens={facts.tokens}
            status={facts.status}
          />
          <dt className="sr-only">Index state</dt>
          <dd
            className={cn(
              "text-[11px] font-medium",
              facts.indexState === "indexed" && "text-gv-moss",
              facts.indexState === "skipped" && "text-gv-amber",
              facts.indexState === "not-indexed" && "text-muted-foreground",
            )}
          >
            {indexLabel}
          </dd>
        </div>
        <span className="text-muted-foreground/30" aria-hidden="true">
          ·
        </span>
        <div className="flex items-center gap-1">
          <dt className="sr-only">Lines</dt>
          <dd className={FIGURE_CLASS} title="Stored line count">
            {formatCount(facts.lines)}
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="sr-only">Size</dt>
          <dd className={FIGURE_CLASS} title="Stored size in bytes">
            {formatBytes(facts.bytes)}
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="sr-only">Indexed chunks</dt>
          <dd
            className={FIGURE_CLASS}
            title={`${formatCount(facts.chunks)} indexed chunks · ${formatTokens(facts.tokens)} tokens`}
          >
            {formatCount(facts.chunks)} chunks
          </dd>
        </div>
      </dl>

      {/* ─── What can I do ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleInsights}
          aria-pressed={insightsOpen}
          aria-label={
            insightsOpen ? "Hide index insights" : "Show index insights"
          }
          title={insightsOpen ? "Hide insights (T)" : "Show insights (T)"}
          className={cn(
            "text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs",
            insightsOpen && "bg-accent/60 text-foreground",
          )}
        >
          {insightsOpen ? (
            <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PanelRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="hidden xl:inline">Insights</span>
        </Button>

        <Button
          size="sm"
          onClick={onAsk}
          disabled={askDisabledReason !== null || isAskPending}
          title={askDisabledReason ?? "Open a chat seeded with this file"}
          className="h-7 gap-1.5 px-2.5 text-xs"
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {isAskPending ? "Opening…" : "Ask"}
          </span>
        </Button>

        {actions}
      </div>
    </div>
  );
}

export default memo(CodeCommandBar);
