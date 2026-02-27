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

/** Single action card in the "Pick Up Where You Left Off" section */
export interface PickUpCard {
  type: "chat" | "file" | "commit";
  title: string;
  description: string;
  href: string;
  projectName: string;
}

/** Data returned by `project.getPickUpWhereYouLeftOff` */
export interface PickUpData {
  cards: PickUpCard[];
}

/** Single language entry for the breakdown chart */
export interface LanguageEntry {
  language: string;
  ext: string;
  count: number;
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

/** Consolidated dashboard payload from `project.getDashboardData` */
export interface DashboardData {
  stats: DashboardStats;
  projects: Project[];
  recentActivity: ActivityEvent[];
  commitChart: CommitChartPoint[];
  pickUp: PickUpData;
  languages: LanguageEntry[];
  attention: NeedsAttentionData;
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
