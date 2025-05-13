"use client";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { FolderGit2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { GradientHeading } from "@/components/custom/gradient-heading";
import toast from "react-hot-toast";
import StatsCardsSection from "@/components/dashboard/stats-cards-section";

// Define the Project type with extended stats
interface Project {
  projectName: string;
  id: string;
  name: string;
  githubUrl: string;
  ownerId: string;
  commitsCount: number;
  filesCount: number;
  stars: number;
  forks: number;
  branches: number;
  contributors: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/project/getUserProject", {
          params: {
            userId: user?.id,
          },
        });

        // Transform the API response to match our Project interface
        const transformedProjects = response.data.projects.map(
          (project: Project) => ({
            id: project.id,
            name: project.projectName,
            githubUrl: project.githubUrl,
            ownerId: project.ownerId,
            commitsCount: project.commitsCount || 0,
            filesCount: project.filesCount || 0,
            stars: project.stars || 0,
            forks: project.forks || 0,
            branches: project.branches || 0,
            contributors: project.contributors || 0,
          })
        );

        setProjects(transformedProjects);
        toast.success("Projects loaded successfully!");
      } catch (error) {
        console.error("Error fetching projects:", error);
        toast.error("Failed to load projects. Please try again.");
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
        <Button
          onClick={() => router.push("/add")}
          className="relative h-10 px-5 bg-gradient-to-r from-primary to-primary/90 text-white text-sm font-medium rounded-md shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group text-[15px]"
        >
          {/* Shimmer effect */}
          <span className="absolute top-0 left-9 w-10 h-full bg-white/20 skew-x-[-20deg] group-hover:translate-x-[400%] transition-transform duration-[1000ms] ease-in-out" />
          {/* Button content */}
          <FolderGit2 className="mr-2 h-6 w-6" />
          Add new repository
        </Button>
      </div>

      {/* Projects Summary */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Loading project statistics...</p>
        </div>
      ) : projects.length > 0 ? (
        <>
          {/* Show stats for the first project by default */}
          {projects[0] && <StatsCardsSection project={projects[0]} />}

          {/* Additional project information could go here */}
          <div className="mt-10">
            <h2 className="text-2xl font-semibold mb-6">Your Projects</h2>
            {/* Project list component could go here */}
          </div>
        </>
      ) : (
        <div className="bg-muted/50 rounded-lg p-8 text-center">
          <FolderGit2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-medium mb-2">No projects yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Start by adding your first GitHub repository to analyze its
            structure, commits and more.
          </p>
          <Button onClick={() => router.push("/add")} className="mx-auto">
            Add your first repository
          </Button>
        </div>
      )}
    </div>
  );
}
