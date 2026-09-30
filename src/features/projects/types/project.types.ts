/**
 * Project View — Shared Type Definitions
 *
 * Central source of truth for all project-related types.
 * Consumed by hooks, components, and the page orchestrator.
 */

// ─── Project Details ─────────────────────────────────────────────────────────

export interface ProjectDetails {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  totalCommits: number;
  totalBranches: number;
  totalContributors: number;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

// ─── Commits ─────────────────────────────────────────────────────────────────

export interface Commit {
  id: string;
  commitHash: string;
  commitMessage: string;
  aiSummary: string | null;
  authorName: string;
  authorEmail: string;
  authorAvatar?: string | null;
  authorDate: Date;
  committerName: string;
  committerEmail: string;
  committerDate: Date;
  projectId: string;
  createdAt: Date;
}

// ─── Tab Navigation ──────────────────────────────────────────────────────────

export type ProjectTab = "overview" | "commits" | "pull-requests" | "issues";
