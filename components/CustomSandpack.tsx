"use client";

import { useEffect, useState, memo } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackFileExplorer,
} from "@codesandbox/sandpack-react";
import { Skeleton } from "@/components/ui/skeleton";
import { dracula } from "@codesandbox/sandpack-themes";

interface CustomSandpackProps {
  projectId: string;
}

const CustomSandpack = ({ projectId }: CustomSandpackProps) => {
  const [files, setFiles] = useState<
    Record<string, { code: string; readOnly: boolean }>
  >({
    "/App.js": {
      code: "// No files loaded yet or project not specified",
      readOnly: true,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjectFiles = async () => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/project/getProjectFiles?projectId=${projectId}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch project files");
        }

        if (Object.keys(data.sandpackFiles).length === 0) {
          setFiles({
            "/App.js": {
              code: "// No files found for this project",
              readOnly: true,
            },
          });
        } else {
          setFiles(data.sandpackFiles);
        }
      } catch (err) {
        console.error("Error fetching project files:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        setFiles({
          "/App.js": {
            code: `// Error loading files: ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
            readOnly: true,
          },
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectFiles();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="w-full min-h-[400px] p-4 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-[400px] p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        <p className="mt-2">
          Please try again or check if you have access to this project.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[500px] border rounded-md overflow-hidden gitvision-code-viewer bg-muted">
      <SandpackProvider files={files} theme={dracula} template="vanilla">
        <SandpackLayout className="flex border-t">
          <SandpackFileExplorer
            style={{
              height: "85vh",
              padding: "0.75rem",
              borderRight: "1px solid #1e293b", // slate-800
              overflowY: "auto",
              fontSize: "15px",
              fontFamily: "'Fira Code', monospace",
            }}
          />
          <SandpackCodeEditor
            showLineNumbers
            readOnly
            showTabs={false}
            wrapContent
            style={{
              height: "85vh",
              padding: "1rem",
              overflow: "auto",
              fontFamily: "'Fira Code', monospace",
            }}
            className="rounded-none border-none bg-transparent"
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
};

export default memo(CustomSandpack);
