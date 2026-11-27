"use client";

import { LogOut } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { SidebarTooltip } from "./SidebarTooltip";

interface SidebarSignOutProps {
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

/**
 * Low-profile sign out trigger integrated into the sidebar footer.
 */
export function SidebarSignOut({ isCollapsed }: SidebarSignOutProps) {
  return (
    <SignOutButton>
      <SidebarTooltip content="Sign out" side="right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          className={cn(
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 cursor-pointer transition-all duration-150 active:scale-95",
            isCollapsed ? "mx-auto h-8 w-8 rounded-lg" : "h-7 w-7 rounded-md",
          )}
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Button>
      </SidebarTooltip>
    </SignOutButton>
  );
}
