/**
 * =============================================================================
 * SIDEBAR SIGN OUT BUTTON COMPONENT
 * =============================================================================
 *
 * Sign out button with Clerk integration.
 * Shows tooltip when sidebar is collapsed.
 *
 * @module Sidebar/components/SidebarSignOut
 */

"use client";

import { LogOut } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SidebarSignOutProps {
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Sign out button with conditional tooltip
 *
 * Features:
 * - Clerk SignOutButton integration
 * - Destructive hover styling
 * - Tooltip when collapsed
 * - Full text when expanded
 */
export function SidebarSignOut({ isCollapsed }: SidebarSignOutProps) {
  if (!isCollapsed) {
    return (
      <SignOutButton>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Button
              aria-label="Sign out"
              // variant="ghost"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer justify-center rounded-xl bg-transparent"
            >
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Sign out
          </TooltipContent>
        </Tooltip>
      </SignOutButton>
    );
  }
}
