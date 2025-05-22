"use client";

import { useParams } from "next/navigation";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAiSummaryOfCommit } from "@/lib/github";

import ErrorState from "../_components/ErrorState";
import ProjectHeader from "../_components/ProjectHeader";
import ProjectStats from "../_components/ProjectStats";
import CommitList from "../_components/CommitList";
import ErrorNotification from "../_components/ErrorNotification";

import {
  fetchProjectCommits,
  fetchProjectDetails,
} from "../_services/projectService";
import { ProjectDetails, CommitData } from "../types";

export default function UserProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { isSignedIn, isLoaded } = useUser();
  const queryClient = useQueryClient();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatingCommitId, setGeneratingCommitId] = useState<string | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Project details query
  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
    error: projectError,
    refetch: refetchProject,
  } = useQuery<ProjectDetails, Error>({
    queryKey: ["project", projectId],
    queryFn: () => fetchProjectDetails(projectId),
    enabled: !!projectId && isLoaded && !!isSignedIn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  console.log("Project Details (from API):", project);

  // Commits query
  const {
    data: commitData,
    isLoading: isCommitsLoading,
    isError: isCommitsError,
    error: commitsError,
    refetch: refetchCommits,
  } = useQuery<CommitData, Error>({
    queryKey: ["commits", projectId, currentPage],
    queryFn: ({ signal }) =>
      fetchProjectCommits(projectId, currentPage, 10, signal),
    enabled:
      !!projectId && isLoaded && !!isSignedIn && !isProjectLoading && !!project,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Extract commit data
  const commits = commitData?.commits || [];
  const totalPages = commitData?.pagination.totalPages || 1;
  const totalCommits = commitData?.pagination.total || 0;

  // Check if the project ID from URL matches the one from API
  useEffect(() => {
    if (project && project.id !== projectId) {
      console.warn(
        "Project ID mismatch! URL ID:",
        projectId,
        "API ID:",
        project.id
      );
    }
  }, [project, projectId]);

  // AI summary generation mutation
  const { mutate: generateAiSummary } = useMutation({
    mutationFn: (commitId: string) => {
      const commit = commits.find((c) => c.id === commitId);
      if (!commit || !project) {
        throw new Error("Commit or project not found");
      }

      return getAiSummaryOfCommit(
        project.githubUrl,
        commit.commitHash,
        projectId, // Use the projectId from URL parameters instead of project.id
        commitId
      );
    },
    onMutate: async (commitId) => {
      setGeneratingCommitId(commitId);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["commits", projectId, currentPage],
      });

      // Snapshot previous data
      const previousCommits = queryClient.getQueryData<CommitData>([
        "commits",
        projectId,
        currentPage,
      ]);

      // Optimistic update
      if (previousCommits) {
        queryClient.setQueryData<CommitData>(
          ["commits", projectId, currentPage],
          (old) => {
            if (!old) return previousCommits;

            return {
              ...old,
              commits: old.commits.map((commit) =>
                commit.id === commitId
                  ? { ...commit, AiSummary: "Generating AI summary..." }
                  : commit
              ),
            };
          }
        );
      }

      return { previousCommits };
    },
    onSuccess: (data, commitId) => {
      // Update cache with real data
      queryClient.setQueryData<CommitData>(
        ["commits", projectId, currentPage],
        (old) => {
          if (!old) return old;

          return {
            ...old,
            commits: old.commits.map((commit) =>
              commit.id === commitId ? { ...commit, AiSummary: data } : commit
            ),
          };
        }
      );

      setGeneratingCommitId(null);
    },
    onError: (err, _commitId, context) => {
      setGeneratingCommitId(null);
      console.error("Error generating AI summary:", err);

      // Show error to user
      setErrorMessage("Failed to generate AI summary. Please try again later.");
      setTimeout(() => setErrorMessage(null), 5000);

      // Revert to previous state if available
      if (context?.previousCommits) {
        queryClient.setQueryData(
          ["commits", projectId, currentPage],
          context.previousCommits
        );
      }
    },
  });

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;
      setCurrentPage(page);

      // Scroll to top of commit section
      const commitSection = document.getElementById("commits-section");
      if (commitSection) {
        commitSection.scrollIntoView({ behavior: "smooth" });
      }
    },
    [totalPages]
  );

  // Clean repository URL (remove .git suffix)
  const cleanRepoUrl = useMemo(
    () => project?.githubUrl?.replace(/\.git$/, "") || "",
    [project?.githubUrl]
  );

  // Loading state
  const isLoading =
    isProjectLoading ||
    (isCommitsLoading && currentPage === 1) || // Only consider first page loading
    !isLoaded;

  // Error state
  const isError = isProjectError || isCommitsError;

  // Combined error message
  const errorText = useMemo(() => {
    if (isProjectError) {
      return projectError?.message || "Failed to load project details";
    }
    if (isCommitsError) {
      return commitsError?.message || "Failed to load commits";
    }
    return null;
  }, [isProjectError, isCommitsError, projectError, commitsError]);

  // Retry function
  const handleRetry = useCallback(() => {
    if (isProjectError) {
      refetchProject();
    }
    if (isCommitsError) {
      refetchCommits();
    }
  }, [isProjectError, isCommitsError, refetchProject, refetchCommits]);

  // Handle AI summary generation
  const handleGenerateAiSummary = useCallback(
    (commitId: string) => {
      generateAiSummary(commitId);
    },
    [generateAiSummary]
  );

  // Error state rendering
  if (isError && !isLoading) {
    return <ErrorState errorText={errorText} onRetry={handleRetry} />;
  }

  // Main render
  return (
    <div className="space-y-8 p-8 bg-gradient-to-b from-background to-background/70">
      {/* Error Notification */}
      <ErrorNotification
        message={errorMessage}
        onDismiss={() => setErrorMessage(null)}
      />

      {/* Project Header */}
      <ProjectHeader
        isLoading={isLoading}
        projectName={project?.projectName}
        githubUrl={project?.githubUrl}
      />

      {/* Project Stats */}
      <ProjectStats isLoading={isLoading} project={project || null} />

      {/* Commits List */}
      <CommitList
        isLoading={isLoading}
        commits={commits}
        totalPages={totalPages}
        totalCommits={totalCommits}
        currentPage={currentPage}
        generatingCommitId={generatingCommitId}
        cleanRepoUrl={cleanRepoUrl}
        projectId={projectId}
        onPageChange={handlePageChange}
        onGenerateSummary={handleGenerateAiSummary}
      />
    </div>
  );
}
