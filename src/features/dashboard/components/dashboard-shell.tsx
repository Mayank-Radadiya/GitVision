"use client";

import { useEffect, useState } from "react";
import Sidebar from "./sidebar/sidebar";
import {
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from "./sidebar/sidebar.constants";

interface DashboardShellProps {
  children: React.ReactNode;
}

/**
 * Client chrome for the (main) route group. Owns the sidebar collapse state
 * and the Cmd/Ctrl+B shortcut, then composes the fixed Sidebar + content
 * column. `children` is a server-rendered page slot passed through untouched,
 * so pages under this shell stay server components and are not pulled into
 * the client bundle.
 */
export function DashboardShell({ children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Handle keyboard shortcut (Cmd/Ctrl + B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sidebarWidth = isCollapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div className="relative min-h-screen">
      {/* The Sidebar renders both the fixed desktop rail and the mobile
          drawer internally — mounting it once avoids duplicated mobile
          triggers/overlays. */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main content - desktop padding only; none on mobile (the sidebar is
          hidden below md, so a static paddingLeft would push content
          off-screen). The width is injected via CSS var so it stays in sync
          with SIDEBAR_WIDTH_* constants. */}
      <main
        className="min-h-screen transition-all duration-300 md:pl-[var(--sidebar-w)]"
        style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
      >
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}
