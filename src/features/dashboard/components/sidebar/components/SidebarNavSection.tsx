"use client";

import { useId } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { NavItem } from "../sidebar.constants";
import { SidebarNavItem } from "./SidebarNavItem";

interface SidebarNavSectionProps {
  /** Section label (e.g., "Menu", "Settings") */
  label: string;
  /** Array of navigation items to render */
  items: NavItem[];
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
  /** Show a subtle divider above the section when collapsed */
  showCollapsedDivider?: boolean;
}

/**
 * Grouped navigation section with accessible list semantics and readable section label.
 */
export function SidebarNavSection({
  label,
  items,
  isCollapsed,
  showCollapsedDivider = false,
}: SidebarNavSectionProps) {
  const pathname = usePathname();
  const headingId = useId();

  return (
    <div
      className={cn(isCollapsed ? "px-2" : "px-3")}
      role="group"
      aria-labelledby={!isCollapsed ? headingId : undefined}
      aria-label={isCollapsed ? label : undefined}
    >
      {/* Section Label (expanded) or subtle divider (collapsed) */}
      {!isCollapsed ? (
        <h2
          id={headingId}
          className="text-muted-foreground mb-1.5 px-2.5 text-[11px] font-medium tracking-[0.06em] uppercase select-none"
        >
          {label}
        </h2>
      ) : (
        showCollapsedDivider && (
          <div
            className="bg-sidebar-border mx-auto mb-2.5 h-px w-5"
            aria-hidden="true"
          />
        )
      )}

      {/* Navigation Items */}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <SidebarNavItem
              key={item.href}
              item={item}
              isActive={isActive}
              isCollapsed={isCollapsed}
            />
          );
        })}
      </ul>
    </div>
  );
}
