"use client";

/**
 * =============================================================================
 * PREMIUM REPOSITORY CARD
 * =============================================================================
 *
 * A premium SaaS-style repository card with:
 * - Glassmorphism with backdrop blur
 * - Animated hover effects with 3D tilt
 * - Gradient accents and glow effects
 * - Clean typography hierarchy
 * - Stats display with icons
 * - Professional color themes
 *
 * @module components/dashboard/repository-card
 */

import { memo } from "react";
import {
  ExternalLink,
  Clock,
  ChevronRight,
  Star,
  GitFork,
  GitCommit,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface RepositoryCardProps {
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
// UTILITY FUNCTIONS
// =============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

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

  const formattedCreatedDate = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <div
        onClick={() => router.push(`/dashboard/user-project/${id}`)}
        className={cn(
          // Base styles
          "relative cursor-pointer overflow-hidden rounded-2xl border p-5",
          // Glassmorphism
          "bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl",
          // Border
          "border-border/60 hover:border-primary/30",
          // Shadow and hover effects
          "shadow-lg shadow-black/5 dark:shadow-black/20",
          "hover:shadow-xl hover:shadow-primary/5 transition-all duration-300",
        )}
      >
        {/* Gradient Accent Background */}
        <div
          className={cn(
            "absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-3xl transition-opacity duration-300 group-hover:opacity-30",
            "bg-gradient-to-br from-primary to-violet-500",
          )}
        />

        {/* Content Container */}
        <div className="relative z-10">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            {/* Left: Avatar + Info */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {/* Avatar with Gradient */}
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  "bg-gradient-to-br from-primary/20 to-violet-500/20",
                  "text-primary font-bold text-lg",
                  "shadow-lg shadow-primary/10",
                  "transition-transform duration-300 group-hover:scale-110",
                )}
              >
                {projectName.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                {/* Project Name */}
                <h3 className="truncate font-semibold text-foreground text-lg group-hover:text-primary transition-colors">
                  {projectName}
                </h3>

                {/* GitHub Link */}
                <div className="mt-1">
                  <Link
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hover:underline">{githubUrl}</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: Arrow */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                "bg-muted/50 group-hover:bg-primary/10",
                "transition-all duration-300",
              )}
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5" />
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-5 flex items-center gap-6">
            {/* Stars */}
            <div className="flex items-center gap-1.5 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
                <Star className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <span className="font-medium text-foreground">
                {formatNumber(star)}
              </span>
              <span className="text-muted-foreground text-xs hidden sm:inline">
                stars
              </span>
            </div>

            {/* Forks */}
            <div className="flex items-center gap-1.5 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                <GitFork className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <span className="font-medium text-foreground">
                {formatNumber(forks)}
              </span>
              <span className="text-muted-foreground text-xs hidden sm:inline">
                forks
              </span>
            </div>

            {/* Commits */}
            <div className="flex items-center gap-1.5 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
                <GitCommit className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <span className="font-medium text-foreground">
                {formatNumber(totalCommits)}
              </span>
              <span className="text-muted-foreground text-xs hidden sm:inline">
                commits
              </span>
            </div>

            {/* Contributors */}
            <div className="flex items-center gap-1.5 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10">
                <Users className="h-3.5 w-3.5 text-violet-500" />
              </div>
              <span className="font-medium text-foreground">
                {formatNumber(totalContributors)}
              </span>
              <span className="text-muted-foreground text-xs hidden sm:inline">
                contributors
              </span>
            </div>
          </div>

          {/* Bottom Row - Created Time Right */}
          <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-muted-foreground/60">
                {totalBranches} branches
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Created {formattedCreatedDate}</span>
            </div>
          </div>
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
