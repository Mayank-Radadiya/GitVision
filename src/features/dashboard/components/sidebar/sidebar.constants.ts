/**
 * =============================================================================
 * SIDEBAR CONSTANTS
 * =============================================================================
 *
 * This file contains all static configuration for the Sidebar component.
 * Centralizing these values makes it easy to:
 * - Add/remove/reorder navigation items
 * - Adjust animation timings
 * - Modify layout dimensions
 *
 * @module Sidebar/constants
 */

import {
  HomeIcon,
  PlusCircle,
  MessageSquare,
  Code2Icon,
  UserCircle,
  Settings,
  LucideIcon,
} from "lucide-react";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Represents a single navigation item in the sidebar
 */
export interface NavItem {
  /** Display name shown in the sidebar */
  name: string;
  /** Route path for navigation */
  href: string;
  /** Lucide icon component to display */
  icon: LucideIcon;
}

/**
 * Props passed to the Sidebar component from the parent layout
 */
export interface SidebarProps {
  /** Whether the sidebar is in collapsed (icon-only) state */
  isCollapsed: boolean;
  /** Callback to toggle collapsed/expanded state */
  onToggle: () => void;
}

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

/** Sidebar width in pixels when collapsed (icon-only mode) */
export const SIDEBAR_WIDTH_COLLAPSED = 72;

/** Sidebar width in pixels when fully expanded */
export const SIDEBAR_WIDTH_EXPANDED = 256;

/** Mobile sidebar width in pixels */
export const SIDEBAR_WIDTH_MOBILE = 288; // 72 * 4 = 288 (w-72)

/** Current app version displayed in sidebar footer */
export const APP_VERSION = "v2.1.3";

// =============================================================================
// ANIMATION CONFIGURATION
// =============================================================================

/**
 * Spring animation config for smooth expand/collapse transitions
 * Used by Framer Motion for sidebar width changes
 */
export const SIDEBAR_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

/**
 * Animation config for fade/slide transitions
 * Used for text labels appearing/disappearing
 */
export const FADE_TRANSITION = {
  duration: 0.2,
};

/**
 * Animation config for active indicator movement
 */
export const ACTIVE_INDICATOR_SPRING = {
  type: "spring" as const,
  stiffness: 350,
  damping: 30,
};

// =============================================================================
// NAVIGATION ITEMS
// =============================================================================

/**
 * Primary navigation items displayed in the "Menu" section
 * Order determines display order in the sidebar
 */
export const PRIMARY_NAVIGATION: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
  },
  {
    name: "Add Repository",
    href: "/create-project",
    icon: PlusCircle,
  },
  {
    name: "Chat",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    name: "Code Viewer",
    href: "/code-viewer",
    icon: Code2Icon,
  },
];

/**
 * Secondary navigation items displayed in the "Settings" section
 * Typically contains user-specific settings and account options
 */
export const SECONDARY_NAVIGATION: NavItem[] = [
  {
    name: "Account",
    href: "/account",
    icon: UserCircle,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];
