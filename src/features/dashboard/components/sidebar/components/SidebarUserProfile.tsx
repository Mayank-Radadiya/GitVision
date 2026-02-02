/**
 * =============================================================================
 * SIDEBAR USER PROFILE COMPONENT
 * =============================================================================
 *
 * Displays the current user's profile information at the bottom of the sidebar.
 * Includes avatar with online status indicator.
 *
 * @module Sidebar/components/SidebarUserProfile
 */

"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { FADE_TRANSITION } from "../sidebar.constants";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface UserData {
  /** User's full name */
  fullName: string | null;
  /** User's profile image URL */
  imageUrl: string;
  /** User's primary email address */
  primaryEmailAddress?: {
    emailAddress: string;
  } | null;
}

interface SidebarUserProfileProps {
  /** User data from Clerk */
  user: UserData;
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * User profile section with avatar and details
 *
 * Features:
 * - User avatar with ring styling
 * - Online status indicator (green dot)
 * - Name and email that fade when collapsed
 * - Hover effect on container
 */
export function SidebarUserProfile({
  user,
  isCollapsed,
}: SidebarUserProfileProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl bg-accent/30 p-2.5 transition-all duration-200 hover:bg-accent/50",
        isCollapsed && "justify-center bg-transparent p-0",
      )}
    >
      {/* Avatar Container */}
      <div className="relative shrink-0">
        <div className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-primary/20">
          <Image
            src={user.imageUrl}
            alt={user.fullName || "User avatar"}
            className="h-full w-full object-cover"
            width={36}
            height={36}
          />
        </div>
        {/* Online Status Indicator */}
        <div
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
          aria-label="Online"
        />
      </div>

      {/* User Details - Animated visibility */}
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={FADE_TRANSITION}
            className="min-w-0 flex-1"
          >
            <p className="truncate text-sm font-medium text-foreground">
              {user.fullName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
