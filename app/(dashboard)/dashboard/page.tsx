"use client";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  FolderGit2,
  GitBranch,
  GitCommit,
  Plus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { GradientHeading } from "@/components/custom/gradient-heading";
import toast from "react-hot-toast";
import StatsCardsSection from "@/components/dashboard/stats-cards-section";
import { RepositoryCard } from "@/components/dashboard/repository-card";
import { Skeleton } from "@/components/ui/skeleton";

// Define the Project type with extended stats
interface dashboardInfo {
  totalProjects: number;
  totalCommits: number;
  totalFiles: number;
  userCredits: number;
}

interface userProject {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  totalCommits: number;
  totalBranches: number;
  totalContributors: number;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [info, setInfo] = useState<dashboardInfo>({
    totalProjects: 0,
    totalCommits: 0,
    totalFiles: 0,
    userCredits: 0,
  });
  const [userProjects, setUserProjects] = useState<userProject[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/project/getDashboardInfo");
        const { dashboardInfo } = response.data;

        const userProjectsResponse = await axios.get(
          `/api/project/getUserProject?userId=${user?.id}`
        );
        const { userProjects } = userProjectsResponse.data;

        setUserProjects(userProjects);
        setInfo(dashboardInfo);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast.error("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);

        // Set a timeout to hide the skeleton UI after a consistent minimum time
        setTimeout(() => {
          setInitialLoading(false);
        }, 1200); // Show skeleton for at least 1.2 seconds
      }
    };

    if (user?.id) {
      fetchProjects();
    } else {
      setLoading(false);
      // Still maintain the initial skeleton even if user is not logged in
      setTimeout(() => {
        setInitialLoading(false);
      }, 2000);
    }
  }, [user?.id]);

  // Skeleton component for project cards
  const ProjectCardSkeleton = () => (
    <div className="rounded-xl border border-blue-200/30 dark:border-blue-800/30 p-5 bg-white/40 dark:bg-slate-900/40 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <Skeleton className="h-7 w-3/5" />
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4 mb-4" />
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <div className="flex justify-between items-center mt-4">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  );

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 sm:gap-4">
        {/* Heading & Description */}
        <div className="text-center sm:text-left">
          <GradientHeading as="h1" className="mb-2">
            Dashboard
          </GradientHeading>
          <p className="text-muted-foreground mb-2 sm:mb-0">
            View and manage your GitHub repository analyses
          </p>
        </div>

        {/* Add Repo Button */}
        <button
          onClick={() => router.push("/add")}
          type="button"
          className="group/button relative inline-flex items-center justify-center overflow-hidden rounded-md bg-blue-500 dark:bg-blue-500/40 backdrop-blur-lg px-4 py-2 text-base font-semibold text-white transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-xl hover:shadow-blue-500/50 border border-white/20"
        >
          <div className="text-[12px] flex items-center gap-2 relative z-10">
            <Plus /> Add New Project
          </div>
          <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]">
            <div className="relative h-full w-10 bg-white/20" />
          </div>
        </button>
      </div>

      {/* Projects Summary */}
      {initialLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <StatsCardsSection project={info} />
      )}

      {/* Projects List */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Your Projects</h2>
        </div>

        {initialLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : userProjects.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
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
          <div className="flex flex-col items-center justify-center h-80 bg-gradient-to-br from-blue-50/30 to-purple-50/30 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl border border-blue-200/30 dark:border-blue-800/30 p-8 shadow-sm">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 p-4 rounded-full mb-5">
              <FolderGit2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>

            <h3 className="text-xl font-medium mb-2">No projects found</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              You haven&apos;t added any GitHub repositories yet. Add one to
              start exploring insights.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 w-full max-w-2xl">
              <div className="flex flex-col items-center p-3 rounded-lg border border-blue-200/50 dark:border-blue-800/30 bg-white/80 dark:bg-slate-900/80">
                <GitCommit className="h-5 w-5 text-blue-500 mb-1" />
                <span className="text-sm text-muted-foreground">
                  Track Commits
                </span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg border border-blue-200/50 dark:border-blue-800/30 bg-white/80 dark:bg-slate-900/80">
                <GitBranch className="h-5 w-5 text-purple-500 mb-1" />
                <span className="text-sm text-muted-foreground">
                  Analyze Branches
                </span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg border border-blue-200/50 dark:border-blue-800/30 bg-white/80 dark:bg-slate-900/80">
                <Users className="h-5 w-5 text-green-500 mb-1" />
                <span className="text-sm text-muted-foreground">
                  View Contributors
                </span>
              </div>
            </div>

            <Button
              onClick={() => router.push("/add")}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 py-2 rounded-md transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Your First Project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
