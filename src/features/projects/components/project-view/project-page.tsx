"use client";

/**
 * Project workspace shell — header, rail, and lazily-mounted sections.
 *
 * Three changes from the version this replaces, and one behaviour deliberately
 * left alone.
 *
 * Removed: the horizontal `ProjectTabs`, replaced by `SectionRail`; the
 * `WorkspaceSummary` strip, whose five equal-weight tiles ranked "branches" level
 * with AI index coverage and printed coverage as a bare string with no bar; and the
 * block that reprinted the active section's own `label` and `description`
 * directly under the tablist it had just been selected from — the tab already said
 * that, in a control the user had just touched.
 *
 * Removed: a second `useProjectCommits` subscription. `project-pulse-widget` called
 * the hook itself while this component also called it and threaded `commits` down
 * for the same widget to re-consume, so one infinite query was mounted twice. The
 * pulse widget's chart is now the real aggregate from `getInsights`, and its feed
 * is `CommitsTab`, which owns the only remaining subscription.
 *
 * Kept: `visited` panels stay mounted once opened, so a search term typed in the
 * commit feed, an expanded commit body, and a selected file all survive navigating
 * away and back. Heavy sections still load only on first visit, via `dynamic` +
 * `SectionSkeleton`. That is the one piece of this file that is load-bearing
 * rather than cosmetic, and it is unchanged.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { MotionConfig } from "framer-motion";
import {
  useProjectDetails,
  useProjectInsights,
} from "@/features/projects/hooks/use-project";
import ProjectHeader from "./project-header";
import SectionRail, { tabId, tabPanelId } from "./rail/section-rail";
import ProjectError from "./project-error";
import { SectionSkeleton } from "./workspace-skeleton";
import {
  PROJECT_COMMAND_EVENT,
  PROJECT_SECTIONS,
  type ProjectCommand,
} from "./workspace-navigation";
import type { ProjectTab } from "@/features/projects/types/project.types";
import type { ActivityWindow } from "./overview/activity-panel";

const OverviewDashboard = dynamic(() => import("./overview"), {
  loading: SectionSkeleton,
});
const CodeViewer = dynamic(() => import("./code-viewer"), {
  loading: SectionSkeleton,
});
const CommitsTab = dynamic(() => import("./tab-content/commits-tab"), {
  loading: SectionSkeleton,
});
const PullRequestsTab = dynamic(() => import("./tab-content/pr-tab"), {
  loading: SectionSkeleton,
});
const IssuesTab = dynamic(() => import("./tab-content/issues-tab"), {
  loading: SectionSkeleton,
});
const TeamTab = dynamic(() => import("./tab-content/team-tab"), {
  loading: SectionSkeleton,
});
const SettingsTab = dynamic(() => import("./tab-content/settings-tab"), {
  loading: SectionSkeleton,
});
const ProjectDetailsDrawer = dynamic(() => import("./project-details-drawer"), {
  ssr: false,
});

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activityWindow, setActivityWindow] = useState<ActivityWindow>(30);
  const [visited, setVisited] = useState<Set<ProjectTab>>(
    () => new Set(["overview"]),
  );
  const {
    data: project,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectDetails(projectId);

  // Fetched at the shell rather than inside `OverviewDashboard` so the rail can
  // badge its sections with the same counts the Overview renders — one query,
  // two consumers, and no chance of the badge and the panel disagreeing.
  const {
    data: insights,
    isLoading: insightsLoading,
    isFetching: insightsFetching,
  } = useProjectInsights(projectId, activityWindow);

  const navigate = useCallback((tab: ProjectTab) => {
    setActiveTab(tab);
    setVisited((previous) =>
      previous.has(tab) ? previous : new Set([...previous, tab]),
    );
  }, []);
  const openDetails = useCallback(() => setDetailsOpen(true), []);
  const openFiles = useCallback(() => navigate("files"), [navigate]);

  useEffect(() => {
    const command = (event: Event) => {
      const detail = (event as CustomEvent<ProjectCommand>).detail;
      if (detail === "details") setDetailsOpen(true);
      else if (PROJECT_SECTIONS.some((section) => section.id === detail))
        navigate(detail);
    };
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]",
        ) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      // Single-key shortcuts only run from the workspace background, so they
      // never override typing or shortcuts inside interactive sections.
      if (!target?.closest("[data-project-shortcuts]")) return;
      if (event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDetailsOpen(true);
      }
      if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        navigate("files");
      }
    };
    window.addEventListener(PROJECT_COMMAND_EVENT, command);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener(PROJECT_COMMAND_EVENT, command);
      window.removeEventListener("keydown", shortcut);
    };
  }, [navigate]);

  if (isError && !isLoading)
    return (
      <ProjectError
        message={error?.message || null}
        onRetry={() => {
          toast.loading("Retrying…", { id: "retry" });
          void refetch().finally(() => toast.dismiss("retry"));
        }}
      />
    );

  const work = insights?.work;
  const railCounts = work
    ? { issues: work.openIssues, "pull-requests": work.openPullRequests }
    : undefined;

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2 }}>
      <div
        className="project-workspace bg-background text-foreground min-h-screen"
        data-project-shortcuts
      >
        <ProjectHeader
          projectName={project?.projectName}
          githubUrl={project?.githubUrl}
          isLoading={isLoading}
          projectId={projectId}
          onOpenCodeViewer={openFiles}
          onOpenDetails={openDetails}
          embeddingStatus={project?.embeddingStatus}
          totalFiles={project?.totalFiles}
          indexedFileCount={project?.indexedFileCount}
          totalFileCount={project?.totalFileCount}
        />
        <div className="mx-auto max-w-7xl px-5 pt-5 pb-12 sm:px-8 lg:px-10">
          <div className="lg:flex lg:gap-8">
            <SectionRail
              activeTab={activeTab}
              onTabChange={navigate}
              counts={railCounts}
            />

            {/* `flex-1` rather than a fixed width: the rail collapses to a
                horizontal row below `lg`, so the content column has to be allowed
                to reclaim the full width rather than sit beside an empty gutter. */}
            <div className="min-w-0 flex-1 pt-6 lg:pt-0">
              {PROJECT_SECTIONS.map(({ id }) => (
                <div
                  key={id}
                  id={tabPanelId(id)}
                  role="tabpanel"
                  aria-labelledby={tabId(id)}
                  tabIndex={0}
                  hidden={activeTab !== id}
                  className="project-section focus-visible:ring-ring min-w-0 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {visited.has(id) &&
                    (isLoading ? (
                      <SectionSkeleton />
                    ) : (
                      <>
                        {id === "overview" && (
                          <OverviewDashboard
                            insights={insights}
                            isInsightsLoading={insightsLoading}
                            isInsightsFetching={insightsFetching}
                            window={activityWindow}
                            onWindowChange={setActivityWindow}
                            embeddingStatus={project?.embeddingStatus}
                            indexedFileCount={project?.indexedFileCount}
                            totalFileCount={project?.totalFileCount}
                            totalFiles={project?.totalFiles}
                            embeddingProgress={project?.embeddingProgress}
                            embeddingError={project?.embeddingError}
                            lastEmbeddingAttempt={project?.lastEmbeddingAttempt}
                            totalCommits={project?.totalCommits}
                            totalContributors={project?.totalContributors}
                            estimatedTokens={project?.estimatedTokens}
                            languages={project?.languages ?? []}
                            briefing={project?.briefing ?? null}
                            onNavigate={navigate}
                          />
                        )}
                        {id === "commits" && (
                          <CommitsTab repoUrl={project?.githubUrl} />
                        )}
                        {id === "pull-requests" && (
                          <PullRequestsTab
                            projectId={projectId}
                            repoUrl={project?.githubUrl}
                          />
                        )}
                        {id === "issues" && (
                          <IssuesTab
                            projectId={projectId}
                            repoUrl={project?.githubUrl}
                          />
                        )}
                        {id === "files" && <CodeViewer projectId={projectId} />}
                        {id === "team" && (
                          <TeamTab
                            projectId={projectId}
                            totalContributors={project?.totalContributors ?? 0}
                          />
                        )}
                        {id === "settings" && project && (
                          <SettingsTab project={project} />
                        )}
                      </>
                    ))}
                </div>
              ))}

              <p className="text-muted-foreground mt-10 hidden text-xs lg:block">
                <kbd className="font-mono">Shift D</kbd> details
                <span className="mx-2">·</span>
                <kbd className="font-mono">Shift F</kbd> files
              </p>
            </div>
          </div>
        </div>
        {project && detailsOpen && (
          <ProjectDetailsDrawer
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            project={project}
          />
        )}
      </div>
    </MotionConfig>
  );
}