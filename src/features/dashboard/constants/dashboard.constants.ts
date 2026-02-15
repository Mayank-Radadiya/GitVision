/**
 * Dashboard constants — colors, animations, and configuration.
 * Keep all magic values here to maintain a single source of truth.
 */

import { GitBranch, FileIcon, Star, CircleDollarSign } from "lucide-react";
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
    icon: GitBranch,
    color: "blue",
    description: "Total Repositories",
    getValue: (s) => s.totalProjects,
  },
  {
    label: "Files",
    icon: FileIcon,
    color: "cyan",
    description: "Files Tracked",
    getValue: (s) => s.totalFiles,
  },
  {
    label: "Commits",
    icon: Star,
    color: "amber",
    description: "Commits Analyzed",
    getValue: (s) => s.totalCommits,
  },
  {
    label: "Credits",
    icon: CircleDollarSign,
    color: "emerald",
    description: "Available Credits",
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
    gradient: string;
    glow: string;
    bg: string;
    text: string;
    border: string;
  }
> = {
  blue: {
    gradient: "from-blue-500 to-blue-600",
    glow: "shadow-blue-500/20",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/20",
  },
  emerald: {
    gradient: "from-emerald-500 to-emerald-600",
    glow: "shadow-emerald-500/20",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/20",
  },
  amber: {
    gradient: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/20",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/20",
  },
  cyan: {
    gradient: "from-cyan-500 to-teal-500",
    glow: "shadow-cyan-500/20",
    bg: "bg-cyan-500/10",
    text: "text-cyan-500",
    border: "border-cyan-500/20",
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
