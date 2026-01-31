/**
 * =============================================================================
 * SIDEBAR NAVIGATION SECTION COMPONENT
 * =============================================================================
 *
 * Groups navigation items under a section label.
 * Renders a list of SidebarNavItem components.
 *
 * @module Sidebar/components/SidebarNavSection
 */

"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavItem } from "../sidebar.constants";
import { SidebarNavItem } from "./SidebarNavItem";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SidebarNavSectionProps {
  /** Section label (e.g., "Menu", "Settings") */
  label: string;
  /** Array of navigation items to render */
  items: NavItem[];
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Navigation section with label and items
 *
 * Features:
 * - Section label hidden when collapsed
 * - Maps items to SidebarNavItem components
 * - Automatically determines active state
 */
export function SidebarNavSection({
  label,
  items,
  isCollapsed,
}: SidebarNavSectionProps) {
  const pathname = usePathname();

  return (
    <div className={cn("space-y-1", isCollapsed ? "px-2" : "px-3")}>
      {/* Section Label - Hidden when collapsed */}
      {!isCollapsed && (
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
      )}

      {/* Navigation Items */}
      {items.map((item) => (
        <SidebarNavItem
          key={item.name}
          item={item}
          isActive={pathname === item.href}
          isCollapsed={isCollapsed}
        />
      ))}
    </div>
  );
}
