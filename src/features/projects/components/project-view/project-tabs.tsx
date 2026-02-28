"use client";

/**
 * Project Tabs — 4-tab underline navigation.
 * Overview / Commits / Pull Requests / Issues
 * Uses Framer Motion layoutId for smooth underline indicator sliding.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, GitCommit, GitPullRequest, CircleDot } from "lucide-react";
import type { ProjectTab } from "@/features/projects/types/project.types";

interface ProjectTabsProps {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
}

const TABS: { id: ProjectTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "commits", label: "Commits", icon: GitCommit },
  { id: "pull-requests", label: "Pull Requests", icon: GitPullRequest },
  { id: "issues", label: "Issues", icon: CircleDot },
];

function ProjectTabs({ activeTab, onTabChange }: ProjectTabsProps) {
  return (
    <div className="relative flex items-center gap-0 border-b border-border/40 overflow-x-auto scrollbar-none">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap flex-shrink-0 ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
            aria-selected={isActive}
            role="tab"
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>

            {/* Underline indicator */}
            {isActive && (
              <motion.div
                layoutId="project-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default memo(ProjectTabs);
