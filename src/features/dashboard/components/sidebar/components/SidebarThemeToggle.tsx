"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { SidebarTooltip } from "./SidebarTooltip";

interface SidebarThemeToggleProps {
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

const THEME_OPTIONS = [
  { value: "system", label: "Use system theme", icon: Monitor },
  { value: "light", label: "Switch to light mode", icon: Sun },
  { value: "dark", label: "Switch to dark mode", icon: Moon },
] as const;

/**
 * Compact, integrated theme control for the sidebar footer.
 * Expanded: 3-way segmented control (System / Light / Dark).
 * Collapsed: Single button toggling between light and dark with icon transition.
 */
export function SidebarThemeToggle({ isCollapsed }: SidebarThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "bg-muted/40 rounded-md",
          isCollapsed ? "mx-auto h-8 w-8" : "h-7 w-[78px]",
        )}
      />
    );
  }

  if (isCollapsed) {
    const isDark = resolvedTheme === "dark";
    const nextTheme = isDark ? "light" : "dark";
    const label = `Switch to ${nextTheme} mode`;

    return (
      <SidebarTooltip content={label} side="right">
        <button
          type="button"
          onClick={() => setTheme(nextTheme)}
          aria-label={label}
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-sidebar-ring mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 active:scale-95"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isDark ? "moon" : "sun"}
              initial={{ opacity: 0, rotate: -35, scale: 0.75 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 35, scale: 0.75 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="flex items-center justify-center"
            >
              {isDark ? (
                <Moon className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Sun className="h-4 w-4" strokeWidth={1.75} />
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </SidebarTooltip>
    );
  }

  const activeTheme = theme ?? "system";

  return (
    <div
      role="group"
      aria-label="Theme preference"
      className="border-border/70 bg-background/70 inline-flex items-center gap-0.5 rounded-md border p-0.5 dark:bg-white/[0.03]"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = activeTheme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-label={option.label}
            aria-pressed={isActive}
            className={cn(
              "focus-visible:ring-sidebar-ring relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] transition-colors duration-150 outline-none focus-visible:ring-2",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="sidebarThemeActivePill"
                aria-hidden="true"
                transition={{ type: "spring", stiffness: 450, damping: 34 }}
                className="bg-sidebar-accent ring-border/60 absolute inset-0 rounded-[4px] shadow-xs ring-1 dark:bg-white/[0.09]"
              />
            )}
            <Icon
              aria-hidden="true"
              strokeWidth={1.75}
              className="relative z-10 h-3.5 w-3.5 transition-transform duration-150"
            />
          </button>
        );
      })}
    </div>
  );
}
