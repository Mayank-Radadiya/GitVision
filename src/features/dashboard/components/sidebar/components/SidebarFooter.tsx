"use client";

import { APP_VERSION } from "../sidebar.constants";
import { SidebarUserProfile } from "./SidebarUserProfile";
import { SidebarCredits } from "./SidebarCredits";
import { SidebarThemeToggle } from "./SidebarThemeToggle";

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
}

/**
 * Cohesive sidebar footer integrating AI Credits, user profile row,
 * version metadata, and compact theme controls.
 */
export function SidebarFooter({ user, isCollapsed }: SidebarFooterProps) {
  return (
    <div className="mt-auto shrink-0">
      {/* AI Credits Instrumentation */}
      <SidebarCredits isCollapsed={isCollapsed} />

      {/* Integrated Footer Region */}
      <div className="border-sidebar-border border-t bg-black/[0.015] dark:bg-white/[0.015]">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-2.5">
            {user && <SidebarUserProfile user={user} isCollapsed={true} />}
            <SidebarThemeToggle isCollapsed={true} />
          </div>
        ) : (
          <>
            {user && <SidebarUserProfile user={user} isCollapsed={false} />}

            <div className="border-sidebar-border/60 flex items-center justify-between border-t px-3 py-2">
              <span className="text-muted-foreground/80 font-mono text-[11px] tabular-nums select-none">
                {APP_VERSION}
              </span>
              <SidebarThemeToggle isCollapsed={false} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
