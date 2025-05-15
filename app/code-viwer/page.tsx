"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CustomSandpack from "@/components/CustomSandpack";
import { RepoSelector } from "@/components/code-viewer/repo-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Project {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  createdAt: string;
}

export default function CodeViewerPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [projectDetails, setProjectDetails] = useState<Project>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!projectId) {
    return (
      <div className="container mx-auto py-16 px-4">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Select a Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground mb-4">
              Choose a project from your repositories to view its code:
            </p>
            <div className="flex flex-col items-center gap-4">
              <RepoSelector />
              <div className="text-center text-sm text-muted-foreground mt-2">
                or
              </div>
              <Button
                onClick={() => (window.location.href = "/dashboard")}
                variant="outline"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    <div className="container mx-auto py-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {projectDetails?.projectName || "Project Code"}
          </h1>
          {projectDetails && (
            <p className="text-muted-foreground mt-1">
              {projectDetails.githubUrl}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <RepoSelector />
          <Button
            variant="outline"
            onClick={() => window.open(projectDetails?.githubUrl, "_blank")}
            disabled={!projectDetails?.githubUrl}
          >
            View on GitHub
          </Button>
          <Button onClick={() => (window.location.href = "/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 sm:p-6">
          <CustomSandpack projectId={projectId} />
        </CardContent>
      </Card>
    </div>
  );
}

// return (
//   <div className="container mx-auto py-8">
//     <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//       <div>
//         <h1 className="text-3xl font-bold">
//           {projectDetails?.projectName || "Project Code"}
//         </h1>
//         {projectDetails && (
//           <p className="text-muted-foreground mt-1">
//             {projectDetails.githubUrl}
//           </p>
//         )}
//       </div>
//       <div className="flex gap-3">
//         <Button
//           variant="outline"
//           onClick={() => window.open(projectDetails?.githubUrl, "_blank")}
//           disabled={!projectDetails?.githubUrl}
//         >
//           View on GitHub
//         </Button>
//         <Button onClick={() => (window.location.href = "/dashboard")}>
//           Back to Dashboard
//         </Button>
//       </div>
//     </div>

//     <Card>
//       <CardContent className="p-0 sm:p-6">
//         <CustomSandpack projectId={projectId} />
//       </CardContent>
//     </Card>
//   </div>
// );
