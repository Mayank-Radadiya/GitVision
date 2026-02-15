"use client";

/**
 * Project Tabs — Animated tab navigation for Commits / Code / Chat.
 * Uses Framer Motion for animated tab indicator.
 * Chat tab links to the existing chat route.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { GitCommit, Code, MessageSquare } from "lucide-react";
import type { ProjectTab } from "@/features/projects/types/project.types";

interface ProjectTabsProps {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  projectId: string;
}

const TABS = [
  { id: "commits" as const, label: "Commits", icon: GitCommit },
  { id: "code" as const, label: "Code", icon: Code },
  { id: "chat" as const, label: "Chat", icon: MessageSquare },
];

function ProjectTabs({ activeTab, onTabChange }: ProjectTabsProps) {
  return (
    <div className="relative flex items-center gap-1 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-1.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
            aria-selected={isActive}
            role="tab"
          >
            {/* Active tab background */}
            {isActive && (
              <motion.div
                layoutId="project-tab-indicator"
                className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}

            <Icon className="relative h-4 w-4" />
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(ProjectTabs);
