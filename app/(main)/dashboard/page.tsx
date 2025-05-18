"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { GradientHeading } from "@/components/custom/gradient-heading";
import toast from "react-hot-toast";
import StatsCardsSection from "@/components/dashboard/stats-cards-section";
import { useQuery } from "@tanstack/react-query";
import { getUserDashboardInfo } from "@/action/dashboard/info.action";
import { getUserProjects } from "@/action/project/userProjects.action";
import ProjectCardSkeleton from "./_components/ProjectCardSkeleton";
import NoProjectFoundCred from "./_components/NoProjectFoundCred";
import dynamic from "next/dynamic";

// Dynamically import RepositoryCard with loading fallback
const RepositoryCard = dynamic(
  () =>
    import("@/components/dashboard/repository-card").then(
      (mod) => mod.RepositoryCard
    ),
  { ssr: false }
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
    staleTime: 5 * 60 * 1000, // 5 minutes
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

  // Set a timer to ensure skeleton is shown for minimum 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkeleton(false);
    }, 2500); // Show skeleton for 2.5 seconds

    return () => clearTimeout(timer);
  }, []);

  // Handle errors
  useEffect(() => {
    if (isInfoError || isProjectsError) {
      toast.error("Failed to load dashboard data. Please try again.");
    }
  }, [isInfoError, isProjectsError]);

  // Determine what to render in the projects section
  const renderProjectsContent = () => {
    // Always show skeleton if we're in the initial loading timer
    if (showSkeleton || isLoading) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    // Show projects if available, otherwise show no projects message
    return userProjects.length > 0 ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {userProjects.map((project) => (
          <RepositoryCard
            key={project.id}
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
        ))}
      </div>
    ) : (
      <NoProjectFoundCred />
    );
  };

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        {/* Heading & Description */}
        <div className="text-center sm:text-left">
          <GradientHeading as="h1" className="mb-2">
            Dashboard
          </GradientHeading>
          <p className="text-muted-foreground">
            View and manage your GitHub repository analyses
          </p>
        </div>

        {/* Add Project Button */}
        <button
          onClick={() => router.push("/dashboard/create-project")}
          type="button"
          className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 px-4 py-2 text-white font-semibold transition-all hover:shadow-lg"
        >
          <Plus className="h-5 w-5 mr-2" /> New Project
        </button>
      </div>

      {/* Dashboard Stats */}
      <StatsCardsSection project={info} />

      {/* Projects List */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-6">Your Projects</h2>
        {renderProjectsContent()}
      </div>
    </div>
  );
}
