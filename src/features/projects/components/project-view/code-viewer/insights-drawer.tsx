"use client";

/**
 * Code Viewer — insights drawer.
 *
 * Reading stays the default; this is opt-in. That is a deliberate constraint
 * inherited from the previous design brief, which says the viewer is "a
 * reading surface that happens to be index-aware, not a dashboard that happens
 * to show code". Every section here answers a question a reader actually has
 * while looking at a file: *why can't I query that language*, *where will my
 * questions actually be answered from*, *is this project even indexed*, *is
 * this file searchable*.
 *
 * Anything that failed that test was left out. There is no commit activity
 * chart here — commits have their own surface — and no "repo health score",
 * because a single number would imply a weighting the underlying data does not
 * support.
 *
 * Honesty rules, enforced by construction rather than by review:
 *   - Every share is of **stored** files. Ingestion drops files before insert,
 *     so stored is a strict subset of the repository, and no number here is
 *     phrased as repo coverage.
 *   - Entry points are labelled as a heuristic and the heuristic is named.
 *   - `describeFileIndex` is the only source of index wording, so the drawer
 *     and the tree can never disagree about what "searchable" means.
 */

import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileCode2, Sparkles, X } from "lucide-react";
import { CoverageMeter, type CoverageBands } from "../charts/coverage-meter";
import { Segment, SegmentedBar } from "../charts/segmented-bar";
import IndexDot from "./index-dot";
import type { FileFacts } from "./code-command-bar";
import type { FileEntry, IndexedFileSummary } from "./utils";
import {
  compactCount,
  concentrationTotal,
  entryPointCandidates,
  formatShare,
  languageSearchableShare,
  shareOf,
  summarizeLanguageIndex,
  tokenConcentration,
} from "./viewer-insights";

interface InsightsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Stored files — the only data source; no extra request. */
  files: readonly FileEntry[];
  /** Aggregate figures over the same set. */
  summary: IndexedFileSummary;
  /** GitHub's reported repo size; null when it was never recorded. */
  repoFileCount: number | null;
  facts: FileFacts | null;
  indexDetail: string;
  onSelectFile: (path: string) => void;
}

const DRAWER_WIDTH = 340;

/** Language mix colours: reuse the chart tokens, cycled, never brown-noise. */
const LANGUAGE_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

function languageColor(index: number): string {
  return LANGUAGE_COLORS[index % LANGUAGE_COLORS.length];
}

function InsightsDrawer({
  open,
  onClose,
  files,
  summary,
  repoFileCount,
  facts,
  indexDetail,
  onSelectFile,
}: InsightsDrawerProps) {
  const bands: CoverageBands = useMemo(
    () => ({
      embedded: summary.indexed,
      skipped: summary.skipped,
      unconsidered: Math.max(0, summary.stored - summary.indexed - summary.skipped),
    }),
    [summary.indexed, summary.skipped, summary.stored],
  );

  const languages = useMemo(() => summarizeLanguageIndex(files), [files]);
  const languageTotalTokens = useMemo(
    () => languages.reduce((sum, row) => sum + row.tokens, 0),
    [languages],
  );
  const concentration = useMemo(() => tokenConcentration(files, 5), [files]);
  const concentrationShare = useMemo(
    () => concentrationTotal(concentration),
    [concentration],
  );
  const entryPoints = useMemo(() => entryPointCandidates(files, 3), [files]);

  const mixSegments: Segment[] = useMemo(
    () =>
      languages.slice(0, 5).map((row, index) => ({
        key: row.language,
        value: row.tokens,
        className: languageColor(index),
      })),
    [languages],
  );

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="insights-drawer"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: DRAWER_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Index insights"
          className="border-border/60 bg-card relative hidden shrink-0 overflow-hidden border-e lg:block"
          style={{ borderInlineEndWidth: 1 }}
        >
          <div
            className="flex h-full w-[340px] min-w-0 flex-col"
            style={{ width: DRAWER_WIDTH }}
          >
            {/* ─── Header ─────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
              <Sparkles className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
              <h2 className="text-foreground text-xs font-semibold tracking-tight">
                Index insights
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Hide index insights"
                className="text-muted-foreground hover:text-foreground hover:bg-accent/50 ms-auto cursor-pointer rounded p-1 transition-colors outline-none focus-visible:ring-ring/70 focus-visible:ring-2"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* ─── 1. Index position ─────────────────────────────────── */}
              <DrawerSection title="Index position">
                {/* The raw "N files" caption lives in the code pane's status
                    bar and is deliberately not duplicated here — one element
                    in the tree may carry that exact string. */}
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {summary.indexed} of {summary.stored} stored files are
                  searchable.
                  {repoFileCount !== null && repoFileCount > summary.stored && (
                    <>
                      {" "}
                      The repository reports {repoFileCount} files; ingestion
                      stores a subset.
                    </>
                  )}
                </p>
                <div className="mt-2">
                  <CoverageMeter bands={bands} showLegend />
                </div>
              </DrawerSection>

              {/* ─── 2. Language index breakdown ──────────────────────── */}
              <DrawerSection title="Language index breakdown">
                <p className="text-muted-foreground mb-2 text-[11px]">
                  Token weight per stored language, and how much of each is
                  searchable.
                </p>
                {mixSegments.length > 1 && (
                  <SegmentedBar
                    segments={mixSegments}
                    ariaLabel="Token weight by language"
                    barClassName="h-1.5"
                  />
                )}
                <ul className="mt-2.5 space-y-1.5">
                  {languages.map((row, index) => {
                    const share = languageSearchableShare(row);
                    return (
                      <li key={row.language} className="text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className={`size-1.5 shrink-0 rounded-full ${languageColor(index)}`}
                          />
                          <span className="text-foreground min-w-0 flex-1 truncate font-medium">
                            {row.label}
                          </span>
                          <span
                            className="text-muted-foreground shrink-0 font-mono tabular-nums"
                            title={`${row.fileCount} files, ${compactCount(row.tokens)} tokens`}
                          >
                            {row.fileCount}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div
                            className="bg-muted/40 relative h-1 min-w-0 flex-1 overflow-hidden rounded-full"
                            role="img"
                            aria-label={`${Math.round(share * 100)}% of ${row.label} files are searchable`}
                          >
                            <div
                              className="bg-gv-moss absolute inset-y-0 left-0 transition-[width] duration-500"
                              style={{ width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
                            {row.searchableCount}/{row.fileCount}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </DrawerSection>

              {/* ─── 3. This file ──────────────────────────────────────── */}
              {facts && (
                <DrawerSection title="This file">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <DrawerFigure label="Lines" value={compactCount(facts.lines)} />
                    <DrawerFigure
                      label="Size"
                      value={`${compactCount(Math.round(facts.bytes / 1024))} KB`}
                    />
                    <DrawerFigure
                      label="Chunks"
                      value={compactCount(facts.chunks)}
                    />
                    <DrawerFigure
                      label="Tokens"
                      value={compactCount(facts.tokens)}
                    />
                  </dl>
                  <div className="mt-2 flex items-center gap-1.5">
                    <IndexDot
                      state={facts.indexState}
                      chunks={facts.chunks}
                      tokens={facts.tokens}
                      status={facts.status}
                    />
                    <span className="text-muted-foreground text-[11px]">
                      {indexDetail}
                    </span>
                  </div>
                  {facts.tokens > 0 && (
                    <div className="mt-2">
                      <div className="text-muted-foreground mb-1 flex items-baseline justify-between text-[10px]">
                        <span>Share of index tokens</span>
                        <span className="font-mono tabular-nums">
                          {formatShare(shareOf(facts.tokens, summary.tokens))}
                        </span>
                      </div>
                      <div className="bg-muted/40 relative h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-gv-wire absolute inset-y-0 left-0 transition-[width] duration-500"
                          style={{
                            width: `${Math.max(
                              shareOf(facts.tokens, summary.tokens) * 100,
                              1,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </DrawerSection>
              )}

              {/* ─── 4. Token concentration ───────────────────────────── */}
              {concentration.length > 0 && (
                <DrawerSection title="Token concentration">
                  <p className="text-muted-foreground mb-2 text-[11px]">
                    Where questions are answered from. The top{" "}
                    {concentration.length} files hold{" "}
                    <span className="text-foreground font-mono tabular-nums">
                      {formatShare(concentrationShare)}
                    </span>{" "}
                    of the index.
                  </p>
                  <ul className="space-y-1.5">
                    {concentration.map((row) => (
                      <li key={row.path}>
                        <button
                          type="button"
                          onClick={() => onSelectFile(row.path)}
                          className="hover:bg-accent/40 group w-full cursor-pointer rounded px-1 py-0.5 text-left transition-colors outline-none focus-visible:ring-ring/70 focus-visible:ring-2"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="text-foreground group-hover:text-foreground min-w-0 flex-1 truncate font-mono text-[10px]">
                              {row.path}
                            </span>
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
                              {compactCount(row.tokens)}
                            </span>
                          </div>
                          <div className="bg-muted/40 relative mt-1 h-1 overflow-hidden rounded-full">
                            <div
                              className="bg-gv-wire/70 absolute inset-y-0 left-0"
                              style={{
                                width: `${Math.max(row.share * 100, 1)}%`,
                              }}
                            />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </DrawerSection>
              )}

              {/* ─── 5. Likely entry points ───────────────────────────── */}
              {entryPoints.length > 0 && (
                <DrawerSection title="Likely entry points">
                  <p className="text-muted-foreground mb-2 text-[11px]">
                    Heuristic: conventional names (README, index, main, app)
                    near the repository root.
                  </p>
                  <ul className="space-y-0.5">
                    {entryPoints.map((entry) => (
                      <li key={entry.path}>
                        <button
                          type="button"
                          onClick={() => onSelectFile(entry.path)}
                          className="hover:bg-accent/40 group flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left transition-colors outline-none focus-visible:ring-ring/70 focus-visible:ring-2"
                        >
                          <FileCode2
                            className="text-muted-foreground h-3 w-3 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[10px]">
                            {entry.path}
                          </span>
                          <span className="text-muted-foreground/70 shrink-0 text-[10px]">
                            {entry.reason}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </DrawerSection>
              )}

              <div className="px-3 py-3">
                <p className="text-muted-foreground/70 text-[10px] leading-relaxed">
                  Figures describe stored files, not the whole repository. A
                  file is searchable when the indexing run produced at least one
                  chunk for it.
                </p>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border/40 border-b px-3 py-3">
      <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DrawerFigure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[10px]">{label}</dt>
      <dd className="text-foreground font-mono text-xs tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export default memo(InsightsDrawer);
