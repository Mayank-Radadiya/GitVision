"use client";

import { memo, useRef } from "react";
import { cn } from "@/shared/lib/utils";
import type { ProjectTab } from "@/features/projects/types/project.types";
import { PROJECT_SECTIONS } from "./workspace-navigation";

export const tabId = (tab: ProjectTab) => `project-tab-${tab}`;
export const tabPanelId = (tab: ProjectTab) => `project-tab-panel-${tab}`;

function ProjectTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div
      role="tablist"
      aria-label="Project sections"
      className="border-border flex scrollbar-none overflow-x-auto border-b"
    >
      {PROJECT_SECTIONS.map(({ id, label, icon: Icon }, index) => (
        <button
          key={id}
          ref={(element) => {
            refs.current[index] = element;
          }}
          id={tabId(id)}
          aria-controls={tabPanelId(id)}
          aria-selected={activeTab === id}
          tabIndex={activeTab === id ? 0 : -1}
          role="tab"
          onClick={() => onTabChange(id)}
          onKeyDown={(event) => {
            let next: number;
            if (event.key === "ArrowRight")
              next = (index + 1) % PROJECT_SECTIONS.length;
            else if (event.key === "ArrowLeft")
              next =
                (index - 1 + PROJECT_SECTIONS.length) % PROJECT_SECTIONS.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = PROJECT_SECTIONS.length - 1;
            else return;
            event.preventDefault();
            onTabChange(PROJECT_SECTIONS[next].id);
            refs.current[next]?.focus();
            refs.current[next]?.scrollIntoView?.({
              block: "nearest",
              inline: "nearest",
            });
          }}
          className={cn(
            "focus-visible:ring-ring relative flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
            activeTab === id
              ? "border-primary text-foreground"
              : "text-muted-foreground hover:border-border hover:text-foreground border-transparent",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
export default memo(ProjectTabs);
