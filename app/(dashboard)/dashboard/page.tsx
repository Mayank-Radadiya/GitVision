"use client";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { FolderGit2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { GradientHeading } from "@/components/custom/gradient-heading";
import toast from "react-hot-toast";

// Define the Project type
interface Project {
  id: string;
  projectName: string;
  githubUrl: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
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
        setProjects(response.data.projects);
        toast.success("Projects loaded successfully!");
      } catch (error) {
        console.error("Error fetching projects:", error);
        toast.error("Failed to load projects. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  });

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
        <div className="flex justify-center items-center">
          <p>Loading projects...</p>
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold mb-2">{project.projectName}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Created at: {new Date(project.createdAt).toLocaleDateString()}
              </p>
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm"
              >
                View on GitHub
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-center items-center">
          <p>No projects found. Add a new repository to get started!</p>
        </div>
      )}
    </div>
  );
}
