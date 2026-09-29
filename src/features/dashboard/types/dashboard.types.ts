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

/** Daily commit count for the chart */
export interface CommitChartPoint {
  date: string;
  commits: number;
}

/** Single language entry for the breakdown chart — matches DB schema in db/schema.ts */
export interface LanguageEntry {
  name: string;
  color: string | null;
  size: number;
  percentage: number;
}

/** Single open issue/PR item */
export interface AttentionItem {
  id: string;
  title: string;
  issueNumber: number;
  isPullRequest: boolean;
  authorLogin: string;
  authorAvatar: string | null;
  projectId: string;
  projectName: string;
  githubUpdatedAt: Date;
}

/** Data returned by `project.getNeedsAttention` */
export interface NeedsAttentionData {
  openIssuesCount: number;
  openPRsCount: number;
  items: AttentionItem[];
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
