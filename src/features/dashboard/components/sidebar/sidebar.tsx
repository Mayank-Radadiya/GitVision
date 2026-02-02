/**
 * =============================================================================
 * SIDEBAR COMPONENT
 * =============================================================================
 *
 * Main sidebar component for the GitVision dashboard.
 * This is the primary export that composes all sub-components.
 *
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * This sidebar follows a modular architecture for scalability:
 *
 * sidebar.tsx (this file)     - Main component, composes sub-components
 * sidebar.constants.ts        - Static configuration (nav items, dimensions)
 * sidebar.hooks.ts            - Business logic and state management
 * components/                 - UI sub-components
 *   ├── SidebarLogo.tsx       - Brand logo with collapse toggle
 *   ├── SidebarNavItem.tsx    - Individual navigation link
 *   ├── SidebarNavSection.tsx - Grouped navigation section
 *   ├── SidebarUserProfile.tsx - User avatar and details
 *   ├── SidebarFooter.tsx     - Version, theme toggle, expand button
 *   ├── SidebarSignOut.tsx    - Clerk sign out button
 *   └── SidebarMobile.tsx     - Mobile-specific components
 *
 * USAGE:
 * ------
 * The sidebar state (collapsed/expanded) is managed by the parent layout.
 * This allows the main content area to sync with sidebar width.
 *
 * ```tsx
 * // In layout.tsx
 * const [isCollapsed, setIsCollapsed] = useState(false);
 *
 * <Sidebar
 *   isCollapsed={isCollapsed}
 *   onToggle={() => setIsCollapsed(!isCollapsed)}
 * />
 * ```
 *
 * KEYBOARD SHORTCUTS:
 * -------------------
 * - Cmd/Ctrl + B: Toggle sidebar collapse (handled in layout)
 *
 * @module Sidebar
 */

"use client";

import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";

// Local imports - constants and hooks
import {
  SidebarProps,
  PRIMARY_NAVIGATION,
  SECONDARY_NAVIGATION,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_SPRING_CONFIG,
} from "./sidebar.constants";
import { useMobileSidebar } from "./sidebar.hooks";

// Local imports - UI components
import {
  SidebarLogo,
  SidebarNavSection,
  SidebarFooter,
  SidebarSignOut,
  MobileMenuButton,
  MobileOverlay,
  MobileDrawer,
} from "./components";

// =============================================================================
// SIDEBAR CONTENT COMPONENT
// =============================================================================

/**
 * Inner content of the sidebar (used in both desktop and mobile views)
 * Extracted to avoid duplication
 */
interface SidebarContentProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

function SidebarContent({ isCollapsed, onToggle }: SidebarContentProps) {
  const { user } = useUser();

  return (
    <div className="flex h-full flex-col">
      {/* Header: Logo & Collapse Toggle */}
      <SidebarLogo isCollapsed={isCollapsed} onToggle={onToggle} />

      {/* Navigation Sections */}
      <div className="flex flex-1 flex-col justify-between overflow-y-auto py-4">
        {/* Primary Navigation */}
        <SidebarNavSection
          label="Menu"
          items={PRIMARY_NAVIGATION}
          isCollapsed={isCollapsed}
        />

        {/* Secondary Navigation & Sign Out */}
        <div>
          <SidebarNavSection
            label="Settings"
            items={SECONDARY_NAVIGATION}
            isCollapsed={isCollapsed}
          />
          <div className={isCollapsed ? "px-2" : "px-3"}>
            <SidebarSignOut isCollapsed={isCollapsed} />
          </div>
        </div>
      </div>

      {/* Footer: User Profile, Version, Theme Toggle */}
      <SidebarFooter
        user={user}
        isCollapsed={isCollapsed}
        onExpand={onToggle}
      />
    </div>
  );
}

// =============================================================================
// MAIN SIDEBAR COMPONENT
// =============================================================================

/**
 * Sidebar component with responsive behavior
 *
 * Features:
 * - Collapsible desktop sidebar (72px ↔ 256px)
 * - Mobile drawer with overlay
 * - Glassmorphism styling
 * - Smooth animations via Framer Motion
 *
 * @param props - Sidebar props from parent layout
 * @param props.isCollapsed - Whether sidebar is in collapsed state
 * @param props.onToggle - Callback to toggle collapsed state
 */
export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  // Mobile state management
  const { isMobileOpen, openMobile, closeMobile } = useMobileSidebar();

  return (
    <>
      {/* ===== MOBILE COMPONENTS ===== */}

      {/* Hamburger Menu Button (mobile only) */}
      <MobileMenuButton onClick={openMobile} />

      {/* Backdrop Overlay (mobile only) */}
      <MobileOverlay isOpen={isMobileOpen} onClose={closeMobile} />

      {/* Drawer Container (mobile only) */}
      <MobileDrawer isOpen={isMobileOpen} onClose={closeMobile}>
        <SidebarContent isCollapsed={false} onToggle={onToggle} />
      </MobileDrawer>

      {/* ===== DESKTOP SIDEBAR ===== */}

      <motion.div
        initial={false}
        animate={{
          width: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        }}
        transition={SIDEBAR_SPRING_CONFIG}
        className="hidden h-screen md:block"
      >
        {/* Glass Effect Container */}
        <div className="glass-sidebar relative h-full border-r border-border/40 bg-background/80 backdrop-blur-xl">
          {/* Subtle Gradient Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-primary/[0.02]" />

          {/* Sidebar Content */}
          <div className="relative h-full">
            <SidebarContent isCollapsed={isCollapsed} onToggle={onToggle} />
          </div>
        </div>
      </motion.div>
    </>
  );
}
