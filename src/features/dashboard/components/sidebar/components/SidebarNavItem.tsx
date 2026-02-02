/**
 * =============================================================================
 * SIDEBAR NAVIGATION ITEM COMPONENT
 * =============================================================================
 *
 * Individual navigation link with active state indicator and animations.
 * Shows tooltip when sidebar is collapsed.
 *
 * @module Sidebar/components/SidebarNavItem
 */

"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  NavItem,
  FADE_TRANSITION,
  ACTIVE_INDICATOR_SPRING,
} from "../sidebar.constants";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SidebarNavItemProps {
  /** Navigation item configuration */
  item: NavItem;
  /** Whether this item's route is currently active */
  isActive: boolean;
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Single navigation item with active state and animations
 *
 * Features:
 * - Animated active indicator bar
 * - Icon glow effect when active
 * - Text fades in/out on collapse
 * - Tooltip shown when collapsed
 */
export function SidebarNavItem({
  item,
  isActive,
  isCollapsed,
}: SidebarNavItemProps) {
  const Icon = item.icon;

  // The actual navigation link content
  const content = (
    <Link href={item.href} className="block">
      <div
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        {/* Active Indicator Bar - Animated position */}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-primary to-primary/60"
            transition={ACTIVE_INDICATOR_SPRING}
          />
        )}

        {/* Icon Container with Glow Effect */}
        <div
          className={cn(
            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
            isActive
              ? "bg-primary/10 text-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.3)]"
              : "text-muted-foreground group-hover:bg-accent group-hover:text-foreground",
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>

        {/* Text Label - Animated visibility */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={FADE_TRANSITION}
              className="truncate whitespace-nowrap"
            >
              {item.name}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Link>
  );

  // Wrap in tooltip when collapsed
  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
