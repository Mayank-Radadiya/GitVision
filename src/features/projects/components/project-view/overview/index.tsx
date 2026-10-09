"use client";

import { memo } from "react";
import { ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { formatCount, formatShortDate } from "@/shared/lib/format";
import type { LanguageEntry, RepoBriefing } from "@/db/schema";
import type { ProjectTab } from "@/features/projects/types/project.types";
import { IndexHealth } from "./index-health";
import {
  ActivityPanel,
  ActivityWindowControl,
  type ActivityWindow,
} from "./activity-panel";
import { MetricStrip, type MetricStripData } from "./metric-strip";
import { WorkItems, type WorkSummary } from "./work-items";
import { Composition } from "./composition";
import { TopContributors, type ContributorRowData } from "./top-contributors";
import { RepoBriefingSection } from "./repo-briefing";
import { RecentActivity, type RecentCommit } from "./recent-activity";
import { ProjectPanel, PanelHeading, SectionHeading } from "../workspace-ui";

export interface OverviewInsights {
  days?: number;
  lastActivityAt?: Date | string | null;
  series: { date: string; commits: number }[];
  priorSeries?: { date: string; commits: number }[];
  totals?: {
    commitsInWindow: number;
    priorWindowCommits: number;
    activeDays: number;
  };
  work?: WorkSummary;
  contributors?: ContributorRowData[];
  fileLanguages?: { language: string; files: number }[];
  index?: { chunks: number; tokens: number };
  recentCommits?: RecentCommit[];
  lifecycle?: {
    firstCommitAt: Date | string | null;
    spanDays: number | null;
    bucketsAgree: boolean;
  };
}

export interface OverviewDashboardProps {
  githubUrl?: string;
  onAskAI?: () => void;
  isAskingAI?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
  onRetryInsights?: () => void;
  isPlaceholderData?: boolean;
  insights: OverviewInsights | undefined;
  isInsightsLoading: boolean;
  isInsightsFetching: boolean;
  /**
   * The insights aggregate failed. It is kept separate from "no insights yet"
   * because the two degrade very differently: `project.getDetails` succeeded, so
   * index health, the briefing and the repository vitals are all still true and
   * still worth showing. Only the insight-derived bands go dark.
   */
  insightsError?: boolean;
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
  star?: number | null;
  forks?: number | null;
  totalBranches?: number | null;
  lastSyncedAt?: Date | string | null;
  languages: LanguageEntry[];
  briefing: RepoBriefing | null | undefined;

  onNavigate?: (tab: ProjectTab) => void;
}

function OverviewDashboard({
  insights,
  isInsightsLoading,
  isInsightsFetching,
  insightsError,
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
  githubUrl,
  onAskAI,
  isAskingAI,
  onSync,
  isSyncing,
  onRetryInsights,
  isPlaceholderData,
}: OverviewDashboardProps) {
  const work = insights?.work;
  const insightsFailed = insightsError === true && insights === undefined;
  const servedWindow = insights?.days;
  const displayedWindow: ActivityWindow =
    servedWindow === 7 || servedWindow === 30 || servedWindow === 90
      ? servedWindow
      : window;
  const series = insights?.series ?? [];
  const hasSearchableIndex = ["completed", "partial"].includes(
    embeddingStatus ?? "",
  );
  const metricData: MetricStripData = {
    totalCommits,
    commitsInWindow: insights?.totals?.commitsInWindow,
    priorWindowCommits: insights?.totals?.priorWindowCommits,
    days: displayedWindow,
    totalFiles,
    indexedFiles: indexedFileCount,
    work,
  };
  return (
    <div className="min-w-0 space-y-6">
      <SectionHeading
        title="Project overview"
        description="A clear view of activity, open work, and repository readiness."
        action={
          <div className="flex items-center gap-2">
            <ActivityWindowControl days={window} onChange={onWindowChange} />
            {onRetryInsights && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRetryInsights}
                disabled={isInsightsFetching}
                aria-label="Refresh project insights"
              >
                <RefreshCw
                  className={`size-4 ${isInsightsFetching ? "animate-spin" : ""}`}
                />
              </Button>
            )}
          </div>
        }
      />
      {insightsError && (
        <div
          role="alert"
          className="border-gv-amber/20 bg-gv-amber/5 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <AlertCircle
            className="text-gv-amber size-4 shrink-0"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1">
            {insights
              ? "Insights could not be refreshed. Showing the last available data."
              : "Activity and work insights are unavailable. Repository details are still available."}
          </p>
          {onRetryInsights && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetryInsights}
              disabled={isInsightsFetching}
            >
              {isInsightsFetching ? "Retrying…" : "Try again"}
            </Button>
          )}
        </div>
      )}
      {isPlaceholderData && (
        <p role="status" className="text-muted-foreground text-xs">
          Loading the {window}-day view. Showing the previous {displayedWindow}
          -day period until it is ready.
        </p>
      )}
      <MetricStrip
        data={metricData}
        isLoading={isInsightsLoading}
        onNavigate={onNavigate}
      />
      <div className="overview-row">
        <ProjectPanel aria-busy={isInsightsFetching}>
          <ActivityPanel
            series={series}
            prior={insights?.priorSeries}
            summary={insights?.totals}
            days={displayedWindow}
            onWindowChange={onWindowChange}
            showWindowControl={false}
            isLoading={isInsightsLoading}
            isFetching={isInsightsFetching}
            hasFailed={insightsFailed}
          />
          {series.length > 0 && (
            <p className="text-muted-foreground mt-4 text-xs">
              {formatShortDate(series[0]!.date)} –{" "}
              {formatShortDate(series[series.length - 1]!.date)} · synced
              history · daily totals in UTC
            </p>
          )}
        </ProjectPanel>
        <ProjectPanel aria-labelledby="open-work-heading">
          <PanelHeading
            id="open-work-heading"
            title="Open work"
            description="Current backlog · all time"
          />
          <WorkItems
            work={work}
            isLoading={isInsightsLoading && !work}
            hasFailed={insightsFailed}
            onOpenIssues={onNavigate ? () => onNavigate("issues") : undefined}
            onOpenPullRequests={
              onNavigate ? () => onNavigate("pull-requests") : undefined
            }
          />
        </ProjectPanel>
      </div>
      <div className="overview-row">
        <ProjectPanel aria-labelledby="recent-activity-heading">
          <PanelHeading
            id="recent-activity-heading"
            title="Recent commits"
            description={
              totalCommits == null
                ? "Latest changes in the synced history"
                : `${formatCount(totalCommits)} repository commits reported by GitHub · all time`
            }
          />
          <RecentActivity
            commits={insights?.recentCommits ?? []}
            githubUrl={githubUrl}
            isLoading={isInsightsLoading && !insights?.recentCommits}
            hasFailed={insightsFailed}
            onViewAll={onNavigate ? () => onNavigate("commits") : undefined}
          />
        </ProjectPanel>
        <ProjectPanel aria-labelledby="contributors-heading">
          <PanelHeading
            id="contributors-heading"
            title="Contributors"
            description={`${totalContributors == null ? "All-time count unavailable" : `${formatCount(totalContributors)} all time`} · activity over ${displayedWindow}d`}
          />
          <TopContributors
            totalCommitsInWindow={insights?.totals?.commitsInWindow}
            contributors={insights?.contributors ?? []}
            windowLabel={`the last ${displayedWindow} days`}
            isLoading={isInsightsLoading && !insights?.contributors}
            hasFailed={insightsFailed}
            onOpenTeam={onNavigate ? () => onNavigate("team") : undefined}
          />
        </ProjectPanel>
      </div>
      <div className="border-border border-t pt-6">
        <h2 className="text-muted-foreground mb-5 text-sm font-semibold">
          Repository context
        </h2>
        <div className="overview-context">
          <ProjectPanel aria-labelledby="index-heading">
            <PanelHeading
              id="index-heading"
              title="AI readiness"
              description="What the repository index can answer"
            />
            <IndexHealth
              status={embeddingStatus}
              indexedFileCount={indexedFileCount}
              totalFileCount={totalFileCount}
              totalFiles={totalFiles}
              embeddingProgress={embeddingProgress}
              embeddingError={embeddingError}
              lastEmbeddingAttempt={lastEmbeddingAttempt}
              chunks={insights?.index?.chunks}
              tokens={insights?.index?.tokens ?? estimatedTokens}
              isLoading={isInsightsLoading && !embeddingStatus}
            />
            <div className="mt-5 flex flex-wrap gap-2">
              {onAskAI && hasSearchableIndex ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAskAI}
                  disabled={isAskingAI}
                >
                  {isAskingAI ? "Opening…" : "Ask about this repository"}
                  <ArrowRight className="size-3.5" />
                </Button>
              ) : (
                onNavigate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("files")}
                  >
                    Explore available files
                    <ArrowRight className="size-3.5" />
                  </Button>
                )
              )}
              {embeddingStatus === "failed" && onSync && (
                <Button size="sm" onClick={onSync} disabled={isSyncing}>
                  {isSyncing ? "Queueing…" : "Retry file sync"}
                </Button>
              )}
            </div>
          </ProjectPanel>
          <ProjectPanel aria-labelledby="composition-heading">
            <PanelHeading
              id="composition-heading"
              title="Languages"
              description="Repository composition and stored source files"
            />
            <Composition
              languages={languages}
              fileCounts={insights?.fileLanguages ?? []}
            />
          </ProjectPanel>
        </div>
      </div>
      <RepoBriefingSection
        briefing={briefing}
        embeddingStatus={embeddingStatus}
      />
    </div>
  );
}
export { OverviewDashboard };
export default memo(OverviewDashboard);
