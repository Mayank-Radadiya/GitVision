/**
 * Dashboard shared type definitions.
 * Single source of truth for all dashboard-related interfaces.
 */

import type { LucideIcon } from "lucide-react";

// ─── API Response Types ──────────────────────────────────────────────────────

/** Stats returned by `project.getDashboardInfo` */
export interface DashboardStats {
  totalProjects: number;
  totalCommits: number;
  totalFiles: number;
  userCredits: number;
}

/** Single project from `project.getAll` */
export interface Project {
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
}

/** Single activity event from `project.getRecentActivity` */
export interface ActivityEvent {
  id: string;
  commitMessage: string;
  authorName: string;
  authorAvatar: string | null;
  authorDate: Date;
  projectId: string;
  projectName: string;
}

/** Daily commit count for the chart */
export interface CommitChartPoint {
  date: string;
  commits: number;
}

// ─── Component Props Types ───────────────────────────────────────────────────

/** Stat card configuration */
export interface StatCardConfig {
  label: string;
  icon: LucideIcon;
  color: StatColor;
  description: string;
  getValue: (stats: DashboardStats) => number;
}

/** Available stat card color themes */
export type StatColor = "blue" | "emerald" | "amber" | "cyan";

/** Sort options for the project list */
export type ProjectSortKey = "recent" | "name" | "commits" | "stars";

export interface ProjectSortOption {
  value: ProjectSortKey;
  label: string;
}
