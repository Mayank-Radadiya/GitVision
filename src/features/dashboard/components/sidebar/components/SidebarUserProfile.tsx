"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { FADE_TRANSITION } from "../sidebar.constants";
import { SidebarSignOut } from "./SidebarSignOut";
import { SidebarTooltip } from "./SidebarTooltip";

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

/**
 * Cohesive footer user row with crisp avatar, clear name/email hierarchy,
 * subtle online status indicator, and low-profile sign-out action.
 */
export function SidebarUserProfile({
  user,
  isCollapsed,
}: SidebarUserProfileProps) {
  const displayName = user.fullName || "Account";
  const email = user.primaryEmailAddress?.emailAddress;

  const avatar = (
    <div className="relative shrink-0">
      <div className="border-border/80 bg-muted h-8 w-8 overflow-hidden rounded-full border">
        <Image
          src={user.imageUrl}
          alt={displayName}
          className="h-full w-full object-cover"
          width={32}
          height={32}
        />
      </div>
      <span
        className="ring-sidebar absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2"
        title="Online"
        aria-label="Online"
      />
    </div>
  );

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <SidebarTooltip
          content={
            <div className="flex flex-col">
              <span className="font-medium">{displayName}</span>
              {email && (
                <span className="text-muted-foreground text-[11px] font-normal">
                  {email}
                </span>
              )}
            </div>
          }
          side="right"
        >
          <div className="flex h-8 w-8 items-center justify-center">
            {avatar}
          </div>
        </SidebarTooltip>
        <SidebarSignOut isCollapsed={true} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "hover:bg-sidebar-accent/40 flex items-center gap-2.5 px-3 py-2.5 transition-colors duration-150",
      )}
    >
      {avatar}

      <AnimatePresence initial={false}>
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={FADE_TRANSITION}
          className="min-w-0 flex-1"
        >
          <p className="text-foreground truncate text-[13px] leading-tight font-medium">
            {displayName}
          </p>
          {email && (
            <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-tight">
              {email}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <SidebarSignOut isCollapsed={false} />
    </div>
  );
}
