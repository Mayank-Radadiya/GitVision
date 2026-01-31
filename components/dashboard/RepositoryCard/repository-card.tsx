"use client";

/**
 * =============================================================================
 * REPOSITORY CARD COMPONENT
 * =============================================================================
 *
 * Premium repository card with modular architecture.
 *
 * ARCHITECTURE:
 * - repository-card.tsx (this file) - Main component
 * - repository-card.constants.ts - Stat config & animations
 * - repository-card.utils.ts - Utility functions
 * - components/
 *   ├── RepositoryCardHeader.tsx - Avatar, name, GitHub link
 *   ├── RepositoryCardStats.tsx - Stars, forks, commits, contributors
 *   └── RepositoryCardFooter.tsx - Branches & creation date
 *
 * @module components/dashboard/RepositoryCard
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Local imports
import {
  RepositoryCardProps,
  CARD_ANIMATION,
} from "./repository-card.constants";
import { extractRepoPath } from "./repository-card.utils";
import {
  RepositoryCardHeader,
  RepositoryCardStats,
  RepositoryCardFooter,
} from "./components";

/**
 * Repository card component
 *
 * Features:
 * - Glassmorphism with backdrop blur
 * - Animated hover lift effect
 * - Repository stats display
 * - Clickable to navigate to project details
 */
export const RepositoryCard = memo(function RepositoryCard({
  id,
  projectName,
  githubUrl,
  star,
  forks,
  totalCommits,
  totalBranches,
  totalContributors,
  createdAt,
}: RepositoryCardProps) {
  const router = useRouter();

  // Format date
  const formattedCreatedDate = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
  });

  // Extract repo path
  const repoPath = extractRepoPath(githubUrl);

  return (
    <motion.div {...CARD_ANIMATION} className="group">
      <div
        onClick={() => router.push(`/dashboard/user-project/${id}`)}
        className={cn(
          // Base styles
          "relative cursor-pointer overflow-hidden rounded-2xl border p-5",
          // Glassmorphism
          "bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl",
          // Border
          "border-border/60 hover:border-primary/30",
          // Shadow
          "shadow-lg shadow-black/5 dark:shadow-black/20",
          "hover:shadow-xl hover:shadow-primary/5 transition-all duration-300",
        )}
      >
        {/* Gradient Accent */}
        <div
          className={cn(
            "absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-3xl",
            "transition-opacity duration-300 group-hover:opacity-30",
            "bg-gradient-to-br from-primary to-violet-500",
          )}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <RepositoryCardHeader
            projectName={projectName}
            githubUrl={githubUrl}
            repoPath={repoPath}
          />

          {/* Stats */}
          <RepositoryCardStats
            star={star}
            forks={forks}
            totalCommits={totalCommits}
            totalContributors={totalContributors}
          />

          {/* Footer */}
          <RepositoryCardFooter
            totalBranches={totalBranches}
            formattedDate={formattedCreatedDate}
          />
        </div>

        {/* Bottom Gradient Line */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-0.5",
            "bg-gradient-to-r from-primary via-violet-500 to-primary",
            "opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          )}
        />
      </div>
    </motion.div>
  );
});
