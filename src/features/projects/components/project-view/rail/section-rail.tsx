"use client";

/**
 * Section rail — the project's navigation.
 *
 * Replaces a horizontal tab bar. The tab bar had two problems that both come from
 * being horizontal: seven equal-width tabs can only fit by shortening their labels
 * past the point of being scannable ("Pull Requests" becomes "Pull Req…"), and it
 * sits directly above the panel it navigates, so it pushes the content down and
 * scrolls away with it. A rail takes its width from the page's whitespace instead
 * of its content's, keeps full labels, and stays visible while the content moves.
 *
 * It keeps the tablist roles deliberately. The obvious move for a rail is
 * `role="navigation"` and links, but the panels below are `role="tabpanel"` and are
 * unmounted lazily by `project-page.tsx`; switching to links would mean either
 * real URLs for every section or a tabpanel that claims to be a panel without a
 * tablist. A vertical tablist is valid ARIA, and keeping it means the existing
 * `aria-labelledby` wiring, the roving tabindex, and the arrow/Home/End keyboard
 * behaviour all survive the redesign unchanged.
 *
 * Orientation is a runtime value rather than a constant because the same component
 * renders as a vertical rail at `lg` and a horizontal pill row below it, and
 * `aria-orientation` has to tell the truth about the layout it is describing.
 */

import { memo, useEffect, useRef, useState } from "react";
import type { ProjectTab } from "@/features/projects/types/project.types";
import { PROJECT_SECTIONS } from "../workspace-navigation";
import { cn } from "@/shared/lib/utils";

export const tabId = (id: string) => `project-tab-${id}`;
export const tabPanelId = (id: string) => `project-panel-${id}`;

/**
 * Matches Tailwind's `lg` breakpoint. The same string constant is what the
 * rail's responsive classes key off, so the JS read and the CSS layout cannot
 * disagree about when the layout flips.
 */
const WIDE_QUERY = "(min-width: 1024px)";

function useIsWide(): boolean {
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    // Read the initial value inside the effect rather than defaulting the state to
    // `true`, so a mobile first paint does not briefly mount the wide rail.
    setIsWide(query.matches);
    const onChange = (event: MediaQueryListEvent) => setIsWide(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isWide;
}

interface SectionRailProps {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  /** Open issue / PR counts, shown as rail badges when known. */
  counts?: Partial<Record<ProjectTab, number>>;
}

function SectionRail({ activeTab, onTabChange, counts = {} }: SectionRailProps) {
  const isWide = useIsWide();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const orientation = isWide ? "vertical" : "horizontal";

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const vertical = orientation === "vertical";
    const forward = vertical ? "ArrowDown" : "ArrowRight";
    const back = vertical ? "ArrowUp" : "ArrowLeft";
    const current = PROJECT_SECTIONS.findIndex((s) => s.id === activeTab);

    let next: number | null = null;
    if (event.key === forward) {
      next = current === PROJECT_SECTIONS.length - 1 ? 0 : current + 1;
    } else if (event.key === back) {
      next = current <= 0 ? PROJECT_SECTIONS.length - 1 : current - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = PROJECT_SECTIONS.length - 1;
    }

    if (next === null) return;
    event.preventDefault();
    const target = PROJECT_SECTIONS[next];
    if (!target) return;
    onTabChange(target.id);
    refs.current[next]?.focus();
  };

  return (
    <nav
      aria-label="Project sections"
      className={cn(
        isWide
          ? "border-border/70 sticky top-[52px] w-52 shrink-0 self-start border-r pr-3"
          : "border-border/70 sticky top-[52px] z-20 -mx-5 border-b bg-background/95 px-5 backdrop-blur",
      )}
    >
      <div
        role="tablist"
        aria-orientation={orientation}
        aria-label="Project sections"
        className={cn(
          isWide
            ? "flex flex-col gap-0.5"
            : "scrollbar-none flex gap-1 overflow-x-auto py-2",
        )}
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
              // Roving tabindex: the tablist is a single tab stop, arrow keys move
              // within it. Matches the behaviour the tab bar already had.
              tabIndex={active ? 0 : -1}
              onKeyDown={onKeyDown}
              onClick={() => onTabChange(section.id)}
              title={isWide ? undefined : section.description}
              className={cn(
                "focus-visible:ring-ring group flex min-w-0 items-center gap-2.5 rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isWide ? "w-full px-2.5 py-2" : "shrink-0 px-3 py-1.5",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              {/* A left bar rather than a filled pill: it marks the section without
                  adding another filled shape to a page where the hero is already the
                  loudest thing on screen. */}
              {isWide && (
                <span
                  className={cn(
                    "h-4 w-0.5 shrink-0 rounded-full transition-colors",
                    active ? "bg-primary" : "bg-transparent",
                  )}
                  aria-hidden="true"
                />
              )}
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <span className="truncate">{section.label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums",
                    active
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { SectionRail, useIsWide };
export default memo(SectionRail);