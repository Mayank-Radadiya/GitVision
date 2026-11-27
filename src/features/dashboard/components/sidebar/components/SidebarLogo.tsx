"use client";

import Link from "next/link";
import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { FADE_TRANSITION } from "../sidebar.constants";
import { SidebarTooltip } from "./SidebarTooltip";

interface SidebarLogoProps {
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
  /** Callback to toggle sidebar state */
  onToggle: () => void;
}

/**
 * Sidebar brand header with refined GitVision wordmark and persistent collapse/expand control.
 */
export function SidebarLogo({ isCollapsed, onToggle }: SidebarLogoProps) {
  return (
    <div
      className={cn(
        "border-sidebar-border flex shrink-0 border-b transition-colors duration-200",
        isCollapsed
          ? "flex-col items-center gap-2 px-2 py-3"
          : "h-14 items-center justify-between px-3.5",
      )}
    >
      {/* Brand Link */}
      <Link
        href="/"
        aria-label="GitVision home"
        className={cn(
          "group focus-visible:ring-sidebar-ring flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2",
          isCollapsed && "justify-center",
        )}
      >
        {/* Precision Logo Container */}
        <div className="border-border/80 bg-background/80 group-hover:border-primary/40 group-hover:bg-primary/[0.06] relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-200 dark:bg-white/[0.04]">
          <Image
            src="/Github.svg"
            alt="GitVision Logo"
            width={18}
            height={18}
            className="transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3"
          />
        </div>

        {/* Crisp Two-Tone Wordmark */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={FADE_TRANSITION}
              className="text-[15px] font-semibold tracking-[-0.025em] whitespace-nowrap select-none"
            >
              <span className="text-foreground">Git</span>
              <span className="text-primary">Vision</span>
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* Persistent Collapse / Expand Control (Desktop) */}
      <SidebarTooltip
        content={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        shortcut="⌘B"
        side="right"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground hidden h-7 w-7 shrink-0 rounded-md transition-all duration-150 active:scale-95 md:flex"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          )}
        </Button>
      </SidebarTooltip>
    </div>
  );
}
