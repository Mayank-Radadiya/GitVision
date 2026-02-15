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
  AiSummary: string | null;
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

/** Response shape from tRPC getCommits (cursor-based) */
export interface CommitPage {
  commits: Commit[];
  nextCursor: string | undefined;
}

// ─── Stat Card Config ────────────────────────────────────────────────────────

export interface ProjectStatConfig {
  key: string;
  label: string;
  icon: string; // Lucide icon name reference
  color: string;
  getValue: (project: ProjectDetails) => string | number;
}

// ─── Tab Navigation ──────────────────────────────────────────────────────────

export type ProjectTab = "commits" | "code" | "chat";
