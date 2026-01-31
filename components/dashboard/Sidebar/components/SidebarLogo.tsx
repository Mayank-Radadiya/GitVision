/**
 * =============================================================================
 * SIDEBAR LOGO COMPONENT
 * =============================================================================
 *
 * Displays the GitVision brand logo with animated text.
 * Includes collapse toggle button when expanded.
 *
 * @module Sidebar/components/SidebarLogo
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FADE_TRANSITION } from "../sidebar.constants";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SidebarLogoProps {
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
  /** Callback to toggle sidebar state */
  onToggle: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Sidebar header with logo and collapse toggle
 *
 * Features:
 * - Animated logo with hover effects
 * - Brand text that fades out when collapsed
 * - Collapse toggle button (desktop only)
 */
export function SidebarLogo({ isCollapsed, onToggle }: SidebarLogoProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center border-b border-border/50 p-4",
        isCollapsed ? "justify-center" : "justify-between",
      )}
    >
      {/* Logo Link */}
      <Link
        href="/"
        className={cn(
          "group flex items-center gap-3 transition-all duration-300",
          isCollapsed && "justify-center",
        )}
      >
        {/* Logo Icon Container */}
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent ring-1 ring-primary/20 transition-all duration-300 group-hover:ring-primary/40 group-hover:shadow-lg group-hover:shadow-primary/10">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent" />
          <Image
            src="/Github.svg"
            alt="GitVision Logo"
            width={24}
            height={24}
            className="relative z-10 transition-transform duration-300 group-hover:scale-110"
          />
        </div>

        {/* Brand Text - Animated visibility */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={FADE_TRANSITION}
              className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-lg font-bold tracking-tight text-transparent"
            >
              Git<span className="text-primary">Vision</span>
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* Collapse Toggle Button - Desktop Only */}
      {!isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Collapse sidebar"
          className="hidden h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
