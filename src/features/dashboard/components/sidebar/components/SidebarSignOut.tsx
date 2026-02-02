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
  if (isCollapsed) {
    return (
      <SignOutButton>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-center rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Sign out
          </TooltipContent>
        </Tooltip>
      </SignOutButton>
    );
  }

  return (
    <SignOutButton>
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg">
          <LogOut className="h-[18px] w-[18px]" />
        </div>
        <span>Sign out</span>
      </Button>
    </SignOutButton>
  );
}
