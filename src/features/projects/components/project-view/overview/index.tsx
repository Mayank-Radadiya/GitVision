"use client";

/**
 * Overview — the project's state, in the order a person asks about it.
 *
 * "Can I ask this thing anything useful?" then "is it moving?" then the supporting
 * counts, then the prose explanation. That ordering is the argument for the layout:
 * index health and the activity trend share the top surface because they are the
 * only two figures that change a decision, and everything below is context for a
 * decision already made.
 *
 * Structure follows one rule that the previous version broke repeatedly: sections
 * are separated by hairlines inside a small number of surfaces, never by a grid of
 * independently rounded cards. The old Overview stacked `WorkspaceSummary` →
 * `BentoCard` → the pulse widget's own `bg-card rounded-xl` → its inner
 * `border rounded-xl shadow-sm`, which is four nested borders deep and reads as
 * four unrelated widgets rather than one page. There are exactly two surfaces here:
 * the hero panel, which earns its elevation because it is the headline, and the
 * body, which is a single `divide-y` stack.
 */

import { memo } from "react";
import type { LanguageEntry, RepoBriefing } from "@/db/schema";
import type { ProjectTab } from "@/features/projects/types/project.types";
import { IndexHealth } from "./index-health";
import { ActivityPanel, type ActivityWindow } from "./activity-panel";
import { MetricStrip, type MetricStripData } from "./metric-strip";
import { WorkItems, type WorkSummary } from "./work-items";
import { Composition } from "./composition";
import {
  TopContributors,
  type ContributorRowData,
} from "./top-contributors";
import { RepoBriefingSection } from "./repo-briefing";

export interface OverviewInsights {
  series: { date: string; commits: number }[];
  priorSeries?: { date: string; commits: number }[];
  totals?: { commitsInWindow: number; priorWindowCommits: number; activeDays: number };
  work?: WorkSummary;
  contributors?: ContributorRowData[];
  fileLanguages?: { language: string; files: number }[];
  index?: { chunks: number; tokens: number };
}

interface OverviewDashboardProps {
  insights: OverviewInsights | undefined;
  isInsightsLoading: boolean;
  isInsightsFetching: boolean;
  window: ActivityWindow;
  onWindowChange: (days: ActivityWindow) => void;

  embeddingStatus?: string | null;
  indexedFileCount?: number | null;
  totalFileCount?: number | null;
  totalFiles?: number | null;
  embeddingProgress?: number | null;
  embeddingError?: string | null;
  lastEmbeddingAttempt?: Date | string | null;

  totalCommits?: number | null;
  totalContributors?: number | null;
  estimatedTokens?: number | null;
  languages: LanguageEntry[];
  briefing: RepoBriefing | null | undefined;

  onNavigate?: (tab: ProjectTab) => void;
}

function OverviewDashboard({
  insights,
  isInsightsLoading,
  isInsightsFetching,
  window,
  onWindowChange,
  embeddingStatus,
  indexedFileCount,
  totalFileCount,
  totalFiles,
  embeddingProgress,
  embeddingError,
  lastEmbeddingAttempt,
  totalCommits,
  totalContributors,
  estimatedTokens,
  languages,
  briefing,
  onNavigate,
}: OverviewDashboardProps) {
  const work = insights?.work;
  const openItems = work ? work.openIssues + work.openPullRequests : null;

  const metricData: MetricStripData = {
    totalCommits,
    totalContributors,
    totalFiles,
    estimatedTokens,
    chunks: insights?.index?.chunks,
    openItems,
  };

  const windowLabel = window === 7 ? "this week" : `the last ${window} days`;

  return (
    <div className="min-w-0 space-y-6">
      {/* ── Hero: the two figures that change a decision ───────────────────── */}
      <div className="border-border bg-card grid gap-px overflow-hidden rounded-lg border shadow-xs">
        <div className="bg-card grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div className="lg:border-border lg:border-r lg:pr-6">
            <IndexHealth
              status={embeddingStatus}
              indexedFileCount={indexedFileCount}
              totalFileCount={totalFileCount}
              totalFiles={totalFiles}
              embeddingProgress={embeddingProgress}
              embeddingError={embeddingError}
              lastEmbeddingAttempt={lastEmbeddingAttempt}
              isLoading={isInsightsLoading && !embeddingStatus}
            />
          </div>
          <ActivityPanel
            series={insights?.series ?? []}
            prior={insights?.priorSeries}
            summary={insights?.totals}
            days={window}
            onWindowChange={onWindowChange}
            isLoading={isInsightsLoading}
            isFetching={isInsightsFetching}
          />
        </div>
      </div>

      <MetricStrip data={metricData} isLoading={false} onNavigate={onNavigate} />

      {/* ── Supporting detail: one surface, hairline-separated ─────────────── */}
      <div className="border-border divide-border/70 divide-y overflow-hidden rounded-lg border">
        <div className="grid gap-x-8 gap-y-6 p-5 lg:grid-cols-2">
          <section aria-label="Work item health">
            <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              Work items
            </h3>
            <WorkItems
              work={work}
              isLoading={isInsightsLoading && !work}
              onOpenIssues={() => onNavigate?.("issues")}
              onOpenPullRequests={() => onNavigate?.("pull-requests")}
            />
          </section>

          <section aria-label="Repository composition">
            <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              Composition
            </h3>
            <Composition
              languages={languages}
              fileCounts={insights?.fileLanguages ?? []}
            />
          </section>
        </div>

        <section aria-label="Top contributors" className="p-5">
          <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
            Top contributors
          </h3>
          <TopContributors
            contributors={insights?.contributors ?? []}
            windowLabel={windowLabel}
            isLoading={isInsightsLoading && !insights?.contributors}
            onOpenTeam={() => onNavigate?.("team")}
          />
        </section>
      </div>

      {/* ── Below the fold ──────────────────────────────────────────────────── */}
      <RepoBriefingSection briefing={briefing} embeddingStatus={embeddingStatus} />
    </div>
  );
}

export { OverviewDashboard };
export default memo(OverviewDashboard);