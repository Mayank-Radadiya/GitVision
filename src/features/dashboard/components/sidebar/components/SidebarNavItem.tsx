"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import {
  NavItem,
  FADE_TRANSITION,
  ACTIVE_INDICATOR_SPRING,
} from "../sidebar.constants";
import { SidebarTooltip } from "./SidebarTooltip";

interface SidebarNavItemProps {
  /** Navigation item configuration */
  item: NavItem;
  /** Whether this item's route is currently active */
  isActive: boolean;
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

/**
 * Single cohesive navigation item with animated active rail indicator and collapsed tooltip.
 */
export function SidebarNavItem({
  item,
  isActive,
  isCollapsed,
}: SidebarNavItemProps) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      aria-label={isCollapsed ? item.name : undefined}
      className={cn(
        "group focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar relative flex h-9 items-center rounded-lg text-[13.5px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.99]",
        isCollapsed ? "mx-auto w-9 justify-center px-0" : "gap-2.5 px-2.5",
        isActive
          ? "bg-primary/[0.09] text-foreground ring-primary/15 dark:bg-primary/[0.13] dark:ring-primary/20 ring-1 ring-inset"
          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground dark:hover:bg-white/[0.04]",
      )}
    >
      {/* Active Indicator Bar */}
      {isActive && (
        <motion.span
          layoutId="sidebarActiveIndicator"
          aria-hidden="true"
          transition={ACTIVE_INDICATOR_SPRING}
          className="bg-primary absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full"
        />
      )}

      {/* Icon */}
      <Icon
        aria-hidden="true"
        strokeWidth={isActive ? 2 : 1.75}
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-150",
          isActive
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground group-hover:scale-[1.04]",
        )}
      />

      {/* Label */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={FADE_TRANSITION}
            className="truncate whitespace-nowrap"
          >
            {item.name}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );

  return (
    <li>
      <SidebarTooltip content={item.name} enabled={isCollapsed} side="right">
        {linkContent}
      </SidebarTooltip>
    </li>
  );
}
