"use client";

import { LayoutGroup, motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  SidebarProps,
  PRIMARY_NAVIGATION,
  SECONDARY_NAVIGATION,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_TRANSITION,
} from "./sidebar.constants";
import { useMobileSidebar } from "./sidebar.hooks";
import {
  SidebarLogo,
  SidebarNavSection,
  SidebarFooter,
  MobileMenuButton,
  MobileOverlay,
  MobileDrawer,
} from "./components";

interface SidebarContentProps {
  isCollapsed: boolean;
  onToggle: () => void;
  layoutGroupId: string;
}

function SidebarContent({
  isCollapsed,
  onToggle,
  layoutGroupId,
}: SidebarContentProps) {
  const { user } = useUser();

  return (
    <LayoutGroup id={layoutGroupId}>
      <div className="flex h-full flex-col">
        {/* Brand Header & Collapse/Expand Control */}
        <SidebarLogo isCollapsed={isCollapsed} onToggle={onToggle} />

        {/* Navigation Sections */}
        <nav
          aria-label="Sidebar navigation"
          className="scrollbar-none flex-1 space-y-5 overflow-y-auto py-4"
        >
          <SidebarNavSection
            label="Menu"
            items={PRIMARY_NAVIGATION}
            isCollapsed={isCollapsed}
          />

          <SidebarNavSection
            label="Settings"
            items={SECONDARY_NAVIGATION}
            isCollapsed={isCollapsed}
            showCollapsedDivider
          />
        </nav>

        {/* AI Credits, Profile & Theme Footer */}
        <SidebarFooter user={user} isCollapsed={isCollapsed} />
      </div>
    </LayoutGroup>
  );
}

/**
 * Responsive GitVision dashboard sidebar with synchronized desktop rail
 * collapse/expand and modal mobile drawer.
 */
export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { isMobileOpen, openMobile, closeMobile } = useMobileSidebar();

  return (
    <>
      {/* Mobile Navigation */}
      <MobileMenuButton onClick={openMobile} />
      <MobileOverlay isOpen={isMobileOpen} onClose={closeMobile} />
      <MobileDrawer isOpen={isMobileOpen} onClose={closeMobile}>
        <SidebarContent
          isCollapsed={false}
          onToggle={onToggle}
          layoutGroupId="mobile-sidebar"
        />
      </MobileDrawer>

      {/* Desktop Navigation Rail */}
      <motion.aside
        aria-label="Primary sidebar"
        initial={false}
        animate={{
          width: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        }}
        transition={SIDEBAR_WIDTH_TRANSITION}
        className="hidden h-screen md:fixed md:inset-y-0 md:left-0 md:z-50 md:block"
      >
        <div className="sidebar-rail relative h-full overflow-hidden">
          <SidebarContent
            isCollapsed={isCollapsed}
            onToggle={onToggle}
            layoutGroupId="desktop-sidebar"
          />
        </div>
      </motion.aside>
    </>
  );
}
