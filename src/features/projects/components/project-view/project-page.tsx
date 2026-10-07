"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { MotionConfig } from "framer-motion";
import {
  useProjectDetails,
  useProjectCommits,
} from "@/features/projects/hooks/use-project";
import ProjectHeader from "./project-header";
import ProjectTabs, { tabId, tabPanelId } from "./project-tabs";
import ProjectError from "./project-error";
import BentoGrid from "./bento-grid";
import WorkspaceSummary from "./workspace-summary";
import { SectionSkeleton } from "./workspace-skeleton";
import {
  PROJECT_COMMAND_EVENT,
  PROJECT_SECTIONS,
  type ProjectCommand,
} from "./workspace-navigation";
import type { ProjectTab } from "@/features/projects/types/project.types";

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
  const { data: commitsData } = useProjectCommits(projectId);
  const commits = useMemo(
    () => commitsData?.pages.flatMap((page) => page.commits) ?? [],
    [commitsData],
  );
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

  const current = PROJECT_SECTIONS.find((section) => section.id === activeTab)!;
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
        <div className="mx-auto max-w-7xl space-y-7 px-5 pt-7 pb-12 sm:px-8 lg:px-10">
          <WorkspaceSummary
            isLoading={isLoading}
            totalCommits={project?.totalCommits}
            totalContributors={project?.totalContributors}
            totalBranches={project?.totalBranches}
            indexedFileCount={project?.indexedFileCount}
            totalFileCount={project?.totalFileCount}
            embeddingStatus={project?.embeddingStatus}
            lastSyncedAt={project?.lastSyncedAt}
            onNavigate={navigate}
            onOpenDetails={openDetails}
          />
          <ProjectTabs activeTab={activeTab} onTabChange={navigate} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {current.label}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {current.description}
              </p>
            </div>
            <p className="text-muted-foreground hidden pt-1 text-xs lg:block">
              Shift D · Details<span className="mx-2">/</span>Shift F · Files
            </p>
          </div>
          {/* Visited panels remain mounted to preserve search, expansion and
              file selection. Heavy sections load only on their first visit. */}
          {PROJECT_SECTIONS.map(({ id }) => (
            <div
              key={id}
              id={tabPanelId(id)}
              role="tabpanel"
              aria-labelledby={tabId(id)}
              tabIndex={0}
              hidden={activeTab !== id}
              className="project-section focus-visible:ring-ring min-h-80 min-w-0 rounded-md focus-visible:ring-2 focus-visible:outline-none"
            >
              {visited.has(id) &&
                (isLoading ? (
                  <SectionSkeleton />
                ) : (
                  <>
                    {id === "overview" && (
                      <BentoGrid
                        projectId={projectId}
                        repoUrl={project?.githubUrl || ""}
                        commits={commits}
                        totalContributors={project?.totalContributors ?? 0}
                        languages={project?.languages ?? []}
                        briefing={project?.briefing ?? null}
                        embeddingStatus={project?.embeddingStatus ?? null}
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
