"use client";

import { memo } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackFileExplorer,
} from "@codesandbox/sandpack-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";

interface CustomSandpackProps {
  projectId: string;
}

// Fetch function that we can reuse and that React Query will call
const fetchProjectFiles = async (projectId: string) => {
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  const response = await fetch(
    `/api/project/getProjectFiles?projectId=${projectId}`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch project files");
  }

  return data;
};

const CustomSandpack = ({ projectId }: CustomSandpackProps) => {
  const { theme } = useTheme();
  const { data, isLoading, error } = useQuery({
    queryKey: ["projectFiles", projectId],
    queryFn: () => fetchProjectFiles(projectId),
    enabled: !!projectId, // Only run the query if we have a projectId
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  // Prepare files for SandpackProvider
  const files =
    data?.sandpackFiles && Object.keys(data.sandpackFiles).length > 0
      ? data.sandpackFiles
      : {
          "/App.js": {
            code: error
              ? `// Error loading files: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              : "// No files found for this project",
            readOnly: true,
          },
        };

  if (isLoading) {
    return (
      <div className="w-full min-h-[400px] p-2 space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-[670px] w-full" />
      </div>
    );
  }

  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return (
      <div className="w-full min-h-[400px] p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p className="text-red-600 dark:text-red-400">Error: {errorMessage}</p>
        <p className="mt-2">
          Please try again or check if you have access to this project.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[500px] rounded-md overflow-hidden">
      <SandpackProvider
        files={files}
        theme={theme === "dark" ? "dark" : "light"}
        template="vanilla"
      >
        <SandpackLayout
          className="flex border-t"
          style={{
            height: "80vh",
            width: "100vw",
            fontFamily: "monospace",
          }}
        >
          <SandpackFileExplorer
            initialCollapsedFolder={["src", "public", "app", "components"]}
            autoHiddenFiles
            style={{
              height: "80vh",
              width: "30vw",
              padding: "0.75rem",
              borderRight: "1px solid #1e293b", // slate-800
              overflowY: "auto",
              fontSize: "15px",
              fontFamily: "'Fira Code', monospace",
            }}
          />
          <SandpackCodeEditor
            showLineNumbers
            showReadOnly
            showTabs={false}
            style={{
              height: "80vh",
              padding: "1rem",
              overflow: "auto",
              fontFamily: "monospace",
            }}
            className="rounded-none border-none bg-transparent"
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
};

export default memo(CustomSandpack);
