"use client";

import { useEffect, useState } from "react";
import CustomSandpack from "@/components/CustomSandpack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams, redirect } from "next/navigation";

interface Project {
  id: string;
  projectName: string;
  githubUrl: string;
  star?: number;
  forks?: number;
  createdAt?: string;
}

export default function CodeViewerPage() {
  const { projectId } = useParams();
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log("Project ID:", projectId);

  if (!projectId || typeof projectId !== "string") {
    redirect("/code-viewer");
  }

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/project/getProjectDetails?projectId=${projectId}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch project details");
        }

        setProjectDetails(data.project);
      } catch (err) {
        console.error("Error fetching project details:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectDetails();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6"></div>
        <div className="h-[600px] w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-16 px-4">
        <Card className="max-w-lg mx-auto border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-center text-red-600 dark:text-red-400">
              Error Loading Project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center">{error}</p>
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                Try Again
              </Button>
              <Button onClick={() => (window.location.href = "/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {projectDetails?.projectName || "Project Code"}
          </h1>
          {projectDetails && (
            <a
              href={projectDetails.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              {projectDetails.githubUrl}
            </a>
          )}
        </div>
      </div>

      {/* Main code viewer */}
      <div className="rounded-xl overflow-hidden border bg-background shadow-lg p-1 sm:p-4">
        <CustomSandpack projectId={projectId} />
      </div>
    </div>
  );
}
