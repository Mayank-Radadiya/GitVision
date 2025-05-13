"use client";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { FolderGit2, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { GradientHeading } from "@/components/custom/gradient-heading";
import toast from "react-hot-toast";
import StatsCardsSection from "@/components/dashboard/stats-cards-section";
import { RepositoryCard } from "@/components/dashboard/repository-card";

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
  const [info, setInfo] = useState<dashboardInfo>();
  const [loading, setLoading] = useState(true);
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
      }
    };

    if (user?.id) {
      fetchProjects();
    }
  }, [user?.id]);

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

      {info && <StatsCardsSection project={info} />}

      {/* Projects List */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Your Projects</h2>
        </div>

        {userProjects.length > 0 ? (
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
        ) : loading ? (
          <div className="flex justify-center items-center h-64 bg-muted/30 rounded-xl border border-border/30">
            <div className="flex flex-col items-center">
              <Loader2 className="animate-spin h-8 w-8 text-primary mb-3" />
              <span className="text-muted-foreground">
                Loading your projects...
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 bg-muted/30 rounded-xl border border-border/30">
            <FolderGit2 className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-medium">No projects found</p>
            <p className="text-muted-foreground text-center max-w-md mt-2 mb-4">
              You haven&apos;t added any projects yet. Add a GitHub repository
              to start analyzing it.
            </p>
            <Button
              variant="default"
              className="bg-primary hover:bg-primary/90"
              onClick={() => router.push("/add")}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Your First Project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
