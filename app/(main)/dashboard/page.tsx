"use client";

/**
 * =============================================================================
 * DASHBOARD PAGE
 * =============================================================================
 *
 * Main dashboard with improved layout:
 * - Clean header with greeting and action button
 * - Stats overview in a modern bento-style grid
 * - Projects list with better visual hierarchy
 *
 * @module app/(main)/dashboard/page
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import toast from "react-hot-toast";
import StatsCardsSection from "@/features/dashboard/components/stats-cards-section";
import { useQuery } from "@tanstack/react-query";
import { getUserDashboardInfo } from "@/features/dashboard/actions/get-dashboard-info";
import { getUserProjects } from "@/features/projects/actions/user-projects-actions";
import ProjectCardSkeleton from "./_components/ProjectCardSkeleton";
import NoProjectFoundCred from "./_components/NoProjectFoundCred";
import dynamic from "next/dynamic";
import { Plus, FolderGit2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { motion } from "framer-motion";

// Dynamically import RepositoryCard with loading fallback
const RepositoryCard = dynamic(
  () =>
    import("@/features/dashboard/components/repository-card").then(
      (mod) => mod.RepositoryCard,
    ),
  { ssr: false },
);

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const [showSkeleton, setShowSkeleton] = useState(true);

  // Fetch dashboard info
  const {
    data: info,
    isLoading: isInfoLoading,
    isError: isInfoError,
  } = useQuery({
    queryKey: ["dashboardInfo"],
    queryFn: getUserDashboardInfo,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch user projects
  const {
    data: userProjects = [],
    isLoading: isProjectsLoading,
    isError: isProjectsError,
  } = useQuery({
    queryKey: ["userProjects", user?.id],
    queryFn: () => getUserProjects(user?.id || ""),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Combined loading state
  const isLoading = isInfoLoading || isProjectsLoading;

  // Set a timer for skeleton display
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkeleton(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Handle errors
  useEffect(() => {
    if (isInfoError || isProjectsError) {
      toast.error("Failed to load dashboard data. Please try again.");
    }
  }, [isInfoError, isProjectsError]);

  // Get first name for greeting
  const firstName = user?.firstName || "there";

  // Render projects content
  const renderProjectsContent = () => {
    if (showSkeleton || isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    return userProjects.length > 0 ? (
      <div className="space-y-3">
        {userProjects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <RepositoryCard
              id={project.id}
              projectName={project.projectName}
              githubUrl={project.githubUrl}
              star={project.star}
              forks={project.forks}
              totalCommits={project.totalCommits}
              totalBranches={project.totalBranches}
              totalContributors={project.totalContributors}
              createdAt={project.createdAt}
            />
          </motion.div>
        ))}
      </div>
    ) : (
      <NoProjectFoundCred />
    );
  };

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <div className="border-b border-border/40 bg-gradient-to-b from-background to-muted/20">
        <div className="px-6 py-8 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            {/* Greeting */}
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold tracking-tight text-foreground"
              >
                Welcome back, {firstName}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mt-1 text-muted-foreground"
              >
                Here&apos;s an overview of your repositories
              </motion.p>
            </div>

            {/* New Project Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={() => router.push("/dashboard/create-project")}
                className="gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
              >
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </motion.div>
          </div>

          {/* Stats Cards */}
          <div className="mt-8">
            <StatsCardsSection project={info} />
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="px-6 py-8 lg:px-8">
        {/* Section Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderGit2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Your Projects
            </h2>
            <p className="text-sm text-muted-foreground">
              {userProjects.length}{" "}
              {userProjects.length === 1 ? "repository" : "repositories"}
            </p>
          </div>
        </div>

        {/* Projects List */}
        {renderProjectsContent()}
      </div>
    </div>
  );
}
