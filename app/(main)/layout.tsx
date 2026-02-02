"use client";

import Sidebar from "@/src/features/dashboard/components/sidebar/sidebar";
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "@/src/features/dashboard/components/sidebar/sidebar.constants"
import { useState, useEffect, createContext, useContext } from "react";


// Context for sidebar state
const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div className="relative min-h-screen">
        {/* Desktop Sidebar - Fixed position */}
        <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex">
          <Sidebar
            isCollapsed={isCollapsed}
            onToggle={() => setIsCollapsed(!isCollapsed)}
          />
        </div>

        {/* Mobile Sidebar */}
        <div className="md:hidden">
          <Sidebar isCollapsed={false} onToggle={() => {}} />
        </div>

        {/* Main content - padding adjusts based on sidebar width */}
        <main
          className="min-h-screen transition-all duration-300"
          style={{
            paddingLeft: isCollapsed
              ? SIDEBAR_WIDTH_COLLAPSED
              : SIDEBAR_WIDTH_EXPANDED,
          }}
        >
          <div className="h-full">{children}</div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
