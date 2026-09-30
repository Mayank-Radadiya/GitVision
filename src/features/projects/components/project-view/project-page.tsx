"use client";

/**
 * Project Page v3 — Tab-driven workspace orchestrator.
 *
 * Layout:
 *   [Header]      — name, health ring, stars/forks, Ask AI + Code Viewer
 *   [Sub-nav]     — Overview / Commits / Pull Requests / Issues (underline tabs)
 *   [Tab Content] — AnimatePresence cross-fade between tab panels
 */

import { useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  useProjectDetails,
  useProjectCommits,
} from "@/features/projects/hooks/use-project";
import ProjectHeader from "./project-header";
import ProjectTabs, { tabId, tabPanelId } from "./project-tabs";
import CodeViewer from "./code-viewer";
import ProjectError from "./project-error";
import BentoGrid, { BentoCard } from "./bento-grid";
import CommitsTab from "./tab-content/commits-tab";
import PullRequestsTab from "./tab-content/pr-tab";
import IssuesTab from "./tab-content/issues-tab";
import type { ProjectTab } from "@/features/projects/types/project.types";

// ─── Tab Transition Variants ─────────────────────────────────────────────────

const TAB_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

/** The panel a tab controls. `tabIndex` keeps it reachable by keyboard when a
 *  panel holds nothing focusable, e.g. the overview grid. */
function TabPanel({ tab, children }: { tab: ProjectTab; children: React.ReactNode }) {
  return (
    <motion.div
      id={tabPanelId(tab)}
      role="tabpanel"
      aria-labelledby={tabId(tab)}
      tabIndex={0}
      variants={TAB_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  // ─── Data ─────────────────────────────────────────────────────────────────
  const {
    data: project,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectDetails(projectId);

  const { data: commitsData } = useProjectCommits(projectId);
  const commits = useMemo(
    () => commitsData?.pages.flatMap((p) => p.commits) ?? [],
    [commitsData],
  );

  const handleOpenCodeViewer = useCallback(() => setShowCodeViewer(true), []);

  // ─── Error ────────────────────────────────────────────────────────────────
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

  // ─── Code Viewer overlay ─────────────────────────────────────────────────
  if (showCodeViewer) {
    return (
      <div className="min-h-screen p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <button
            onClick={() => setShowCodeViewer(false)}
            className="text-muted-foreground hover:text-foreground group flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
          >
            <span className="inline-block transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            Back to {project?.projectName || "Dashboard"}
          </button>
          <CodeViewer projectId={projectId} />
        </div>
      </div>
    );
  }

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          {/* Header */}
          <ProjectHeader
            projectName={project?.projectName}
            githubUrl={project?.githubUrl}
            stars={project?.star}
            forks={project?.forks}
            totalCommits={project?.totalCommits}
            totalContributors={project?.totalContributors}
            totalBranches={project?.totalBranches}
            isLoading={isLoading}
            projectId={projectId}
            onOpenCodeViewer={handleOpenCodeViewer}
            embeddingStatus={project?.embeddingStatus}
            totalFiles={project?.totalFiles}
            indexedFileCount={project?.indexedFileCount}
            totalFileCount={project?.totalFileCount}
          />

          {/* Sub-navigation tabs */}
          {!isLoading && (
            <ProjectTabs activeTab={activeTab} onTabChange={setActiveTab} />
          )}

          {/* Tab Content with AnimatePresence */}
          <AnimatePresence mode="wait">
            {/* ── Overview ── */}
            {activeTab === "overview" && (
              <TabPanel tab="overview">
                {isLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <BentoCard className="h-64 animate-pulse" />
                    <BentoCard className="h-64 animate-pulse" />
                    <BentoCard className="h-96 animate-pulse sm:col-span-2" />
                  </div>
                ) : (
                  <BentoGrid
                    projectId={projectId}
                    repoUrl={project?.githubUrl || ""}
                    commits={commits}
                    totalContributors={project?.totalContributors ?? 0}
                    languages={project?.languages ?? []}
                  />
                )}
              </TabPanel>
            )}

            {/* ── Commits ── */}
            {activeTab === "commits" && (
              <TabPanel tab="commits">
                <CommitsTab />
              </TabPanel>
            )}

            {/* ── Pull Requests ── */}
            {activeTab === "pull-requests" && (
              <TabPanel tab="pull-requests">
                <PullRequestsTab
                  projectId={projectId}
                  repoUrl={project?.githubUrl}
                />
              </TabPanel>
            )}

            {/* ── Issues ── */}
            {activeTab === "issues" && (
              <TabPanel tab="issues">
                <IssuesTab projectId={projectId} repoUrl={project?.githubUrl} />
              </TabPanel>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
