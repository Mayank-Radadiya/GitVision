"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import axios from "axios";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpRight } from "lucide-react";
import FailedToLoad from "./FailedToLoad";
import NoRepoFound from "./NoRepoFound";

export interface UserProject {
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

// Fetch user projects API function
const fetchUserProjects = async (userId: string) => {
  if (!userId) return [];
  const response = await axios.get(
    `/api/project/getUserProjects?userId=${userId}`
  );
  return response.data || [];
};

export default function RepoList() {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSkeleton, setShowSkeleton] = useState(true);

  // Use React Query for data fetching with caching
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["userProjects", user?.id],
    queryFn: () => fetchUserProjects(user?.id || ""),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Data will be considered fresh for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  // Show skeleton for at least 1 second
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkeleton(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const filteredProjects = projects.filter(
    (project: UserProject) =>
      project.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.githubUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render skeleton during loading or initial 1 second
  if (isLoading || showSkeleton) {
    return (
      <div className="space-y-4 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pb-4">
          <div className="flex flex-col gap-4 px-10">
            {Array(3)
              .fill(0)
              .map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 border border-border rounded-xl backdrop-blur-md space-y-4 sm:space-y-0"
                >
                  <div className="w-full sm:max-w-md">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-10 w-full sm:w-32" />
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // If something went wrong then show the error message
  if (error) {
    return <FailedToLoad />;
  }

  // If no projects found and not loading
  if (projects.length === 0 && !isLoading) {
    return <NoRepoFound />;
  }

  // Show project list
  return (
    <div className="space-y-4 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8">
      <div className="relative flex items-center px-10">
        <Search className="absolute left-13 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 outline-none focus-visible:ring-0 focus-visible:border-0 duration-200"
        />
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pb-4">
        <div className="flex flex-col gap-4 px-10">
          {filteredProjects.map((project: UserProject) => (
            <Link
              key={project.id}
              href={`/code-viewer/${project.id}`}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 border border-border rounded-xl backdrop-blur-md hover:border-gray-500 transition-all space-y-4 sm:space-y-0 hover:scale-[1.01]"
            >
              <div className="w-full sm:max-w-md">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {project.projectName}
                </h3>
                <p className="text-sm text-muted-foreground truncate hover:text-primary/80">
                  {project.githubUrl}
                </p>
              </div>

              <Button className="w-full sm:w-auto flex items-center justify-center text-white dark:bg-[#e2e2e2d7] dark:text-black/80 hover:scale-[1.02] transition-all ">
                View Code
                <ArrowUpRight className="ml-2 size-4.5" />
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
