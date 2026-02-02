"use client";

import { useParams, redirect, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ExternalLink,
  GithubIcon,
  ArrowLeft,
  RefreshCw,
  Code,
} from "lucide-react";
import CustomSandpack from "@/features/code-viewer/components/custom-sandpack";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { toast } from "react-hot-toast";

interface Project {
  id: string;
  projectName: string;
  githubUrl: string;
}

// Fetch function for project details
const fetchProjectDetails = async (projectId: string) => {
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const response = await fetch(
    `/api/project/getProjectDetails?projectId=${projectId}`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch project details");
  }

  return data.project;
};

export default function CodeViewerPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  if (!projectId) {
    redirect("/code-viewer");
  }

  const {
    data: projectDetails,
    isLoading,
    error,
    refetch,
  } = useQuery<Project, Error>({
    queryKey: ["projectDetails", projectId],
    queryFn: () => fetchProjectDetails(projectId),
    staleTime: 1000 * 60 * 10, // Consider data fresh for 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const handleRefresh = async () => {
    toast.promise(refetch(), {
      loading: "Refreshing project data...",
      success: "Project data refreshed",
      error: "Failed to refresh data",
    });
  };

  const handleBackToProjects = () => {
    router.push("/code-viewer");
  };

  // TypeScript type guard for error handling
  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return (
      <div className="container mx-auto py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="max-w-lg mx-auto bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-center text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
                <span>⚠️</span> Error Loading Project
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center font-medium text-red-700 dark:text-red-300">
                {errorMessage}
              </p>
              <div className="flex justify-center gap-4 mt-6">
                <Button
                  onClick={handleBackToProjects}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Back to Projects
                </Button>
                <Button
                  onClick={handleRefresh}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-800/50 shadow-sm animate-pulse">
            <div className="h-10 w-3/4 bg-blue-200 dark:bg-blue-800/40 rounded mb-4"></div>
            <div className="h-5 w-1/2 bg-blue-100 dark:bg-blue-900/40 rounded mb-4"></div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border bg-background shadow-xl p-1 sm:p-4 h-[70vh] animate-pulse">
          <div className="flex h-full">
            <div className="w-1/4 bg-gray-100 dark:bg-gray-800/40 border-r"></div>
            <div className="w-3/4 p-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700/40 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700/40 rounded w-1/2 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700/40 rounded w-5/6 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700/40 rounded w-2/3 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700/40 rounded w-3/4 mb-3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-4 flex flex-col gap-4"
      >
        {/* Project Header */}
        <div className="p-6 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 text-transparent bg-clip-text">
                {projectDetails?.projectName || "Project Code"}
              </h1>

              {projectDetails?.githubUrl && (
                <div className="mt-1 space-y-2">
                  <a
                    href={projectDetails.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors group"
                  >
                    <GithubIcon size={16} />
                    <span className="text-sm font-medium">
                      {projectDetails.githubUrl}
                    </span>
                    <ExternalLink
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Code Explorer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-xl overflow-hidden border bg-background shadow-xl"
      >
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold">Code Explorer</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
            <span className="w-3 h-3 rounded-full bg-green-400"></span>
          </div>
        </div>

        <CustomSandpack projectId={projectId} />
      </motion.div>
    </div>
  );
}
