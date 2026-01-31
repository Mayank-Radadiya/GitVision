/**
 * =============================================================================
 * REPOSITORY CARD CONSTANTS
 * =============================================================================
 *
 * Configuration for repository card colors and styling.
 *
 * @module RepositoryCard/constants
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface RepositoryCardProps {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  totalCommits: number;
  totalBranches: number;
  totalContributors: number;
  createdAt: string;
}

// =============================================================================
// STAT CONFIGURATION
// =============================================================================

/**
 * Configuration for each stat type displayed in the card
 */
export const STAT_CONFIG = {
  stars: {
    label: "stars",
    color: "amber",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-500",
  },
  forks: {
    label: "forks",
    color: "blue",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-500",
  },
  commits: {
    label: "commits",
    color: "emerald",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-500",
  },
  contributors: {
    label: "contributors",
    color: "violet",
    bgClass: "bg-violet-500/10",
    textClass: "text-violet-500",
  },
} as const;

// =============================================================================
// ANIMATION CONFIGURATION
// =============================================================================

export const CARD_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" },
  whileHover: { y: -4 },
} as const;
