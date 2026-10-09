"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
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
import { OverviewSkeleton } from "./overview/overview-skeleton";
import {
  PROJECT_COMMAND_EVENT,
  PROJECT_SECTIONS,
  type ProjectCommand,
  readWorkspaceLocation,
  workspaceUrl,
} from "./workspace-navigation";
import {
  ProjectActionsProvider,
  useProjectActionController,
} from "./project-actions";
import { SectionHeading, InlineError } from "./workspace-ui";
import type { ProjectTab } from "@/features/projects/types/project.types";
import type { ActivityWindow } from "./overview/activity-panel";

// Overview gets its own skeleton because it is the only section whose loading
// shape has to match a specific layout — the shared one is a generic 2-up grid
// that would jump a screenful when insights resolve.
const OverviewDashboard = dynamic(() => import("./overview"), {
  loading: OverviewSkeleton,
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { section: activeTab, days: activityWindow } =
    readWorkspaceLocation(searchParams);
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [visited, setVisited] = useState<Set<ProjectTab>>(
    () => new Set([activeTab]),
  );
  const {
    data: project,
    isLoading,
    isError,
    isFetching: detailsFetching,
    error,
    refetch,
  } = useProjectDetails(projectId);
  const actions = useProjectActionController(
    projectId,
    project?.embeddingStatus,
  );

  // Fetched at the shell rather than inside `OverviewDashboard` so the rail can
  // badge its sections with the same counts the Overview renders — one query,
  // two consumers, and no chance of the badge and the panel disagreeing.
  const {
    data: insights,
    isLoading: insightsLoading,
    isFetching: insightsFetching,
    isError: insightsError,
    isPlaceholderData: insightsPlaceholder,
    refetch: refetchInsights,
  } = useProjectInsights(projectId, activityWindow);

  const navigate = useCallback(
    (tab: ProjectTab) => {
      const url = workspaceUrl(
        pathname,
        new URLSearchParams(window.location.search),
        { section: tab },
      );
      if (url !== `${window.location.pathname}${window.location.search}`)
        window.history.pushState(null, "", url);
      setVisited((previous) =>
        previous.has(tab) ? previous : new Set([...previous, tab]),
      );
    },
    [pathname],
  );
  const setActivityWindow = useCallback(
    (days: ActivityWindow) => {
      window.history.replaceState(
        null,
        "",
        workspaceUrl(pathname, new URLSearchParams(window.location.search), {
          days,
        }),
      );
    },
    [pathname],
  );
  useEffect(() => {
    setVisited((previous) =>
      previous.has(activeTab) ? previous : new Set([...previous, activeTab]),
    );
  }, [activeTab]);
  const openSection = useCallback(
    (tab: ProjectTab) => {
      navigate(tab);
      requestAnimationFrame(() => {
        document
          .getElementById(tabPanelId(tab))
          ?.focus({ preventScroll: true });
      });
    },
    [navigate],
  );
  const openDetails = useCallback(() => setDetailsOpen(true), []);
  const openFiles = useCallback(() => openSection("files"), [openSection]);

  useEffect(() => {
    const command = (event: Event) => {
      const detail = (event as CustomEvent<ProjectCommand>).detail;
      if (detail === "details") setDetailsOpen(true);
      else if (PROJECT_SECTIONS.some((section) => section.id === detail))
        openSection(detail);
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
        openSection("files");
      }
    };
    window.addEventListener(PROJECT_COMMAND_EVENT, command);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener(PROJECT_COMMAND_EVENT, command);
      window.removeEventListener("keydown", shortcut);
    };
  }, [openSection]);

  if (isError && !isLoading && !project)
    return (
      <ProjectError
        message={error?.message || null}
        pending={detailsFetching}
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
      <ProjectActionsProvider
        actions={actions}
        projectName={project?.projectName ?? "this project"}
      >
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
            lastSyncedAt={project?.lastSyncedAt}
          />
          <SectionRail
            activeTab={activeTab}
            onTabChange={navigate}
            counts={railCounts}
          />
          <div className="project-content mx-auto max-w-[1280px] px-4 pt-6 pb-12 md:px-8">
            {isError && project && (
              <div className="mb-5">
                <InlineError
                  message="Couldn’t refresh project details. Showing the last available data."
                  onRetry={() => void refetch()}
                  pending={detailsFetching}
                />
              </div>
            )}
            <div className="min-w-0">
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
                      <>
                        {id === "overview" ? (
                          <OverviewSkeleton />
                        ) : (
                          <SectionSkeleton />
                        )}
                      </>
                    ) : (
                      <>
                        {id === "overview" && (
                          <OverviewDashboard
                            insights={insights}
                            isInsightsLoading={insightsLoading}
                            isInsightsFetching={insightsFetching}
                            window={activityWindow}
                            onWindowChange={setActivityWindow}
                            insightsError={insightsError}
                            isPlaceholderData={insightsPlaceholder}
                            onRetryInsights={() => {
                              void refetchInsights();
                            }}
                            githubUrl={project?.githubUrl}
                            onAskAI={actions.askAI}
                            isAskingAI={actions.asking}
                            onSync={actions.syncProject}
                            isSyncing={actions.syncing}
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
                            star={project?.star}
                            forks={project?.forks}
                            totalBranches={project?.totalBranches}
                            lastSyncedAt={project?.lastSyncedAt}
                            languages={project?.languages ?? []}
                            briefing={project?.briefing ?? null}
                            onNavigate={openSection}
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
                        {id === "files" && (
                          <div className="space-y-5">
                            <SectionHeading
                              title="Repository files"
                              description="Read the source and explore the files available to AI."
                            />
                            <CodeViewer projectId={projectId} />
                          </div>
                        )}
                        {id === "team" && (
                          <TeamTab
                            projectId={projectId}
                            window={activityWindow}
                            onWindowChange={setActivityWindow}
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
      </ProjectActionsProvider>
    </MotionConfig>
  );
}
