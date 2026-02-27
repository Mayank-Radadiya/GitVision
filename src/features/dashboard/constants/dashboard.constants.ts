/**
 * Dashboard constants — colors, animations, and configuration.
 * Keep all magic values here to maintain a single source of truth.
 */

import {
  FolderGit2,
  FileCode2,
  GitCommitHorizontal,
  Coins,
} from "lucide-react";
import type {
  StatCardConfig,
  ProjectSortOption,
  StatColor,
} from "../types/dashboard.types";

// ─── Stat Card Configuration ─────────────────────────────────────────────────

/** Configuration for each stat card in the bento grid */
export const STAT_CARDS: StatCardConfig[] = [
  {
    label: "Projects",
    icon: FolderGit2,
    color: "blue",
    description: "Tracked repos",
    getValue: (s) => s.totalProjects,
  },
  {
    label: "Files",
    icon: FileCode2,
    color: "cyan",
    description: "Indexed files",
    getValue: (s) => s.totalFiles,
  },
  {
    label: "Commits",
    icon: GitCommitHorizontal,
    color: "amber",
    description: "Analyzed",
    getValue: (s) => s.totalCommits,
  },
  {
    label: "Credits",
    icon: Coins,
    color: "emerald",
    description: "Available",
    getValue: (s) => s.userCredits,
  },
];

// ─── Sort Options ────────────────────────────────────────────────────────────

export const SORT_OPTIONS: ProjectSortOption[] = [
  { value: "recent", label: "Most Recent" },
  { value: "name", label: "Name (A-Z)" },
  { value: "commits", label: "Most Commits" },
  { value: "stars", label: "Most Stars" },
];

// ─── Color Tokens ────────────────────────────────────────────────────────────

/** Tailwind class mappings for each stat color theme */
export const COLOR_TOKENS: Record<
  StatColor,
  {
    bg: string;
    text: string;
    border: string;
    gradient: string;
    glow: string;
  }
> = {
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-border/50",
    gradient: "from-blue-500 to-blue-600",
    glow: "shadow-blue-500/20",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-border/50",
    gradient: "from-emerald-500 to-emerald-600",
    glow: "shadow-emerald-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-border/50",
    gradient: "from-amber-500 to-amber-600",
    glow: "shadow-amber-500/20",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-border/50",
    gradient: "from-cyan-500 to-cyan-600",
    glow: "shadow-cyan-500/20",
  },
};

// ─── Animation Presets ───────────────────────────────────────────────────────

/** Staggered fade-in for list items */
export const STAGGER_ANIMATION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: (index: number) => ({
    duration: 0.35,
    delay: index * 0.06,
    ease: "easeOut" as const,
  }),
};

/** Card hover lift effect */
export const CARD_HOVER = {
  whileHover: { y: -3 },
  transition: { duration: 0.2 },
};

/** Skeleton count for loading states */
export const SKELETON_COUNT = 4;

/** Max recent activity items */
export const ACTIVITY_LIMIT = 8;

/** Days to show in commit chart */
export const CHART_DAYS = 7;
