"use client";

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

interface SidebarTooltipProps {
  /** Tooltip label text */
  content: ReactNode;
  /** Optional keyboard shortcut badge (e.g. "⌘B") */
  shortcut?: string;
  /** Only wrap with Tooltip when enabled (default: true) */
  enabled?: boolean;
  /** Delay before showing tooltip in ms */
  delayDuration?: number;
  /** Preferred side relative to trigger */
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}

/**
 * Consistent dark/light popover-styled tooltip for sidebar rail items and actions.
 */
export function SidebarTooltip({
  content,
  shortcut,
  enabled = true,
  delayDuration = 150,
  side = "right",
  children,
}: SidebarTooltipProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        className="bg-popover text-popover-foreground border-border/80 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-lg [&>svg]:bg-popover [&>svg]:fill-popover"
      >
        <span>{content}</span>
        {shortcut && (
          <kbd className="bg-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[10px] leading-none font-medium">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
