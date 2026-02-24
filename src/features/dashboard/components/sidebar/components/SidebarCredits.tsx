/**
 * =============================================================================
 * SIDEBAR CREDITS COMPONENT
 * =============================================================================
 *
 * Displays the user's available AI credits.
 * Shows a sleek progress bar mimicking a "usage limit" feel.
 *
 * @module Sidebar/components/SidebarCredits
 */

"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { useDashboardInfo } from "@/features/dashboard/hooks/use-dashboard";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { FADE_TRANSITION } from "../sidebar.constants";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SidebarCreditsProps {
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * AI Credits progress and upgrade link.
 * Calculates visually appealing threshold colors:
 * - > 20%: Primary (Healthy)
 * - 5% - 20%: Yellow/Orange (Warning)
 * - < 5%: Red (Critical)
 */
export function SidebarCredits({ isCollapsed }: SidebarCreditsProps) {
  // Fetch credits. Using useDashboardInfo so it syncs with standard dashboard state.
  const { data } = useDashboardInfo();

  // Default parsing logic handling missing/loading state gracefully.
  const credits = data?.userCredits ?? 0;

  // Determine baseline for the progress bar rendering.
  // We assume 100 as standard free-tier limit to establish 0-100% fill.
  const MAX_FREE_CREDITS = 100;
  const percentage = Math.min((credits / MAX_FREE_CREDITS) * 100, 100);

  // Dynamic styling based on threshold
  const isWarning = percentage <= 20 && percentage > 5;
  const isCritical = percentage <= 5;

  const barColorClass = isCritical
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-500"
      : "bg-primary";

  // When collapsed, render just the bolt. Wrapped in Tooltip.
  const collapsedContent = (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
        "bg-accent/30 hover:bg-accent/50 group cursor-pointer",
      )}
    >
      <Zap
        className={cn(
          "h-4 w-4 transition-colors",
          isCritical
            ? "text-red-500 group-hover:text-red-400"
            : isWarning
              ? "text-amber-500 group-hover:text-amber-400"
              : "text-foreground group-hover:text-primary",
        )}
      />
    </div>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Link href="/billing" className="mb-2 ml-1 block w-full">
            {collapsedContent}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {credits} Credits Remaining
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded View
  return (
    <Link href="/billing" className="mb-3 block px-3">
      <div className="group relative overflow-hidden rounded-xl bg-accent/30 p-4 transition-all duration-300 hover:bg-accent/50 hover:shadow-md">
        {/* Subtle Background Glow on Hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Content Container */}
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE_TRANSITION}
            >
              <div className="mb-2 flex items-center gap-2">
                <Zap
                  className={cn(
                    "h-4 w-4 text-primary",
                    isCritical && "text-red-500",
                    isWarning && "text-amber-500",
                  )}
                />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  AI Credits
                </h4>
              </div>

              {/* Text readout */}
              <div className="mb-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {credits}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {MAX_FREE_CREDITS}
                </span>
              </div>

              {/* Progress Bar Background */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-background/80 shadow-inner">
                {/* Progress Bar Foreground (Animated Fill) */}
                <motion.div
                  className={cn("h-full rounded-full", barColorClass)}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>

              {/* Upgrade Trigger Text */}
              <p className="mt-2 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                Get more credits →
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Link>
  );
}
