/**
 * Code Viewer — recently viewed files.
 *
 * A real tablist with one tab stop: arrows move between tabs and select the
 * focused one, while only the active tab exposes its close control. Closing
 * never empties the viewer on its own; the orchestrator selects a neighbour.
 */

import { memo, useRef, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface ViewerTab {
  path: string;
  name: string;
  parent?: string;
}

interface ViewerTabStripProps {
  tabs: ViewerTab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

function ViewerTabStrip({ tabs, activePath, onSelect, onClose }: ViewerTabStripProps) {
  const tabRefs = useRef<Array<HTMLDivElement | null>>([]);

  if (tabs.length === 0) return null;

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    const tab = tabs[next];
    tabRefs.current[next]?.focus();
    if (tab) onSelect(tab.path);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
      case "Enter":
      case " ": {
        const tab = tabs[index];
        if (tab) {
          event.preventDefault();
          onSelect(tab.path);
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Recently viewed files"
      className="border-border/60 bg-card flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5"
    >
      <AnimatePresence initial={false}>
        {tabs.map((tab, index) => {
          const isActive = tab.path === activePath;
          return (
            <motion.div
              key={tab.path}
              layout
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 overflow-hidden"
            >
              <div
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                title={tab.path}
                onClick={() => onSelect(tab.path)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  "flex max-w-48 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors duration-150 outline-none",
                  "focus-visible:ring-ring/70 focus-visible:ring-2 focus-visible:ring-inset",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{tab.name}</span>
                {tab.parent && (
                  <span className="hidden max-w-20 truncate opacity-70 xl:inline">
                    {tab.parent}
                  </span>
                )}
                {isActive && (
                  <button
                    type="button"
                    aria-label={`Close ${tab.name} tab`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose(tab.path);
                    }}
                    className="hover:bg-primary/20 -mr-1 shrink-0 cursor-pointer rounded p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default memo(ViewerTabStrip);
