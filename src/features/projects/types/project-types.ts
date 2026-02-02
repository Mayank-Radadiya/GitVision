// Shared interfaces used across components

export interface ProjectDetails {
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
  ownerId: string;
}

export interface Commit {
  id: string;
  commitHash: string;
  commitMessage: string;
  AiSummary: string | null;
  authorName: string;
  authorEmail: string;
  authorAvatar?: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  committerDate: string;
  projectId: string;
  createdAt: string;
}

export interface CommitData {
  commits: Commit[];
  pagination: {
    totalPages: number;
    total: number;
  };
}
