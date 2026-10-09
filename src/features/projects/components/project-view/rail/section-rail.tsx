"use client";

import { memo, useRef } from "react";
import { motion } from "framer-motion";
import type { ProjectTab } from "@/features/projects/types/project.types";
import { PROJECT_SECTIONS } from "../workspace-navigation";
import { cn } from "@/shared/lib/utils";

export const tabId = (id: string) => `project-tab-${id}`;
export const tabPanelId = (id: string) => `project-panel-${id}`;

interface SectionRailProps {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  counts?: Partial<Record<ProjectTab, number>>;
}

function SectionRail({
  activeTab,
  onTabChange,
  counts = {},
}: SectionRailProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const current = PROJECT_SECTIONS.findIndex(
      (section) => section.id === activeTab,
    );
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (current + 1) % PROJECT_SECTIONS.length;
        break;
      case "ArrowLeft":
        next =
          (current - 1 + PROJECT_SECTIONS.length) % PROJECT_SECTIONS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = PROJECT_SECTIONS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onTabChange(PROJECT_SECTIONS[next]!.id);
    refs.current[next]?.focus();
    refs.current[next]?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  };

  return (
    <nav
      aria-label="Project sections"
      className="project-navigation border-border bg-background sticky top-0 z-20 border-b"
    >
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div
          role="tablist"
          aria-orientation="horizontal"
          aria-label="Project sections"
          className="flex scrollbar-none gap-5 overflow-x-auto sm:gap-6"
        >
          {PROJECT_SECTIONS.map((section, index) => {
            const active = activeTab === section.id;
            const count = counts[section.id];
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                ref={(node) => {
                  refs.current[index] = node;
                }}
                id={tabId(section.id)}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={tabPanelId(section.id)}
                tabIndex={active ? 0 : -1}
                onKeyDown={onKeyDown}
                onClick={() => onTabChange(section.id)}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 py-3.5 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {section.label}
                {count !== undefined && count > 0 && (
                  <span
                    className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
                    aria-label={`${count} open`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
                {active && (
                  <motion.span
                    layoutId="project-tab-indicator"
                    className="bg-primary absolute inset-x-0 bottom-0 h-0.5"
                    transition={{ duration: 0.15 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export { SectionRail };
export default memo(SectionRail);
