"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import RepoList from "@/components/code-viewer/repo-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CodeViewerPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  // Redirect to the project specific page if we have a projectId
  useEffect(() => {
    if (projectId) {
      window.location.href = `/code-viewer/${projectId}`;
    }
  }, [projectId]);

  return (
    <div className="container mx-auto py-16 px-4">
      <Card className="mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Select a Project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground mb-4">
            Choose a project from your repositories to view its code:
          </p>
          <div className="flex flex-col items-center gap-4">
            <RepoList />
            <div className="text-center text-sm text-muted-foreground mt-2">
              or
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
