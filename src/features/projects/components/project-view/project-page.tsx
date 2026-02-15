"use client";

/**
 * Project Page — Root client-side orchestrator for the project detail view.
 *
 * Architecture:
 * - Subscribes to useProjectDetails() for project metadata
 * - Tab state is local (Commits | Code | Chat)
 * - Each section manages its own data:
 *   • CommitSection → useProjectCommits() + useGenerateAiSummary()
 *   • CodeViewer → useProjectFiles()
 *   • Chat → redirects to existing chat route
 *
 * This isolation ensures that:
 * - Commit pagination doesn't rerender header/stats
 * - AI summary generation doesn't refetch project details
 * - Code viewer loads files only when the Code tab is active
 */

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useProjectDetails } from "@/features/projects/hooks/use-project";
import type { ProjectTab } from "@/features/projects/types/project.types";
import ProjectHeader from "./project-header";
import ProjectStats from "./project-stats";
import ProjectTabs from "./project-tabs";
import CommitSection from "./commit-section/commit-section";
import CodeViewer from "./code-viewer";
import ProjectError from "./project-error";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  // ─── Project details query ──────────────────────────────────────────────
  const {
    data: project,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectDetails(projectId);

  // ─── Local tab state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ProjectTab>("commits");

  /** Handle tab change — Chat tab navigates to chat route */
  const handleTabChange = useCallback(
    (tab: ProjectTab) => {
      if (tab === "chat") {
        router.push(`/chat/${projectId}`);
        return;
      }
      setActiveTab(tab);
    },
    [router, projectId],
  );

  // ─── Error state ────────────────────────────────────────────────────────
  if (isError && !isLoading) {
    return (
      <ProjectError
        message={error?.message || null}
        onRetry={() => {
          toast.loading("Retrying...", { id: "retry" });
          refetch().finally(() => toast.dismiss("retry"));
        }}
      />
    );
  }

  // ─── Main layout ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-8">
        {/* Header with back button + project name */}
        <ProjectHeader
          projectName={project?.projectName}
          githubUrl={project?.githubUrl}
          isLoading={isLoading}
        />

        {/* Stats Grid */}
        <ProjectStats project={project} isLoading={isLoading} />

        {/* Tab Navigation */}
        <ProjectTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          projectId={projectId}
        />

        {/* Tab Content */}
        <div>
          {activeTab === "commits" && (
            <CommitSection
              projectId={projectId}
              repoUrl={project?.githubUrl || ""}
            />
          )}

          {activeTab === "code" && <CodeViewer projectId={projectId} />}
        </div>
      </div>
    </div>
  );
}
