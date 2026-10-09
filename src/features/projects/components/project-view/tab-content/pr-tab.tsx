"use client";
import RepositoryWorkList from "./repository-work-list";
export default function PullRequestsTab({
  projectId,
  repoUrl,
}: {
  projectId: string;
  repoUrl?: string;
}) {
  return (
    <RepositoryWorkList projectId={projectId} repoUrl={repoUrl} isPullRequest />
  );
}
