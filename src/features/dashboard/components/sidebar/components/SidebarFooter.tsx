/**
 * =============================================================================
 * SIDEBAR FOOTER COMPONENT
 * =============================================================================
 *
 * Bottom section of the sidebar containing:
 * - User profile (when signed in)
 * - App version
 * - Theme toggle
 * - Expand button (when collapsed)
 *
 * @module Sidebar/components/SidebarFooter
 */

"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import ModeToggle from "@/shared/components/theme/mode-toggle";
import { APP_VERSION } from "../sidebar.constants";
import { SidebarUserProfile, SidebarCredits } from "./";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface UserData {
  fullName: string | null;
  imageUrl: string;
  primaryEmailAddress?: {
    emailAddress: string;
  } | null;
}

interface SidebarFooterProps {
  /** User data from Clerk (null if not signed in) */
  user: UserData | null | undefined;
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
  /** Callback to expand the sidebar */
  onExpand: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Sidebar footer with user profile, version, and controls
 *
 * Features:
 * - AI Credits Display
 * - User profile section (when signed in)
 * - App version display (when expanded)
 * - Theme toggle button
 * - Expand button (when collapsed)
 */
export function SidebarFooter({
  user,
  isCollapsed,
  onExpand,
}: SidebarFooterProps) {
  return (
    <div className="border-border/50 flex flex-col gap-2 border-t p-3">
      {/* AI Credits */}
      <SidebarCredits isCollapsed={isCollapsed} />

      {/* User Profile */}
      {user && <SidebarUserProfile user={user} isCollapsed={isCollapsed} />}

      {/* Version & Theme Toggle Row */}
      <div
        className={cn(
          "mt-3 flex items-center",
          isCollapsed ? "justify-center" : "justify-between px-2",
        )}
      >
        {/* App Version - Hidden when collapsed */}
        {!isCollapsed && (
          <span className="text-muted-foreground/60 text-[10px] font-medium">
            {APP_VERSION}
          </span>
        )}
        <ModeToggle />
      </div>

      {/* Expand Button - Shown only when collapsed */}
      {isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onExpand}
          aria-label="Expand sidebar"
          className="text-muted-foreground hover:bg-accent hover:text-foreground mt-2 h-8 w-full rounded-lg"
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </Button>
      )}
    </div>
  );
}
