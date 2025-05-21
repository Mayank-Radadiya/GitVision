"use client";

import RepoList from "@/components/code-viewer/repo-selector";

export default function CodeViewerPage() {
  return (
    <div className=" w-full mx-auto py-16 px-4">
      <p className="text-center text-muted-foreground mb-4">
        Choose a project from your repositories to view its code:
      </p>
      <div className="flex flex-col items-center gap-4">
        <RepoList />
      </div>
    </div>
  );
}
