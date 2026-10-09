"use client";
import RepositoryWorkList from "./repository-work-list";
export default function IssuesTab({
  projectId,
  repoUrl,
}: {
  projectId: string;
  repoUrl?: string;
}) {
  return (
    <RepositoryWorkList
      projectId={projectId}
      repoUrl={repoUrl}
      isPullRequest={false}
    />
  );
}
