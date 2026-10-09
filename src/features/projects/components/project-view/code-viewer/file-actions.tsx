"use client";

/**
 * Code Viewer — file actions.
 *
 * Everything that is worth doing to a file but not worth a permanent button.
 * The old panel put this behind a hand-rolled `role="menu"` div that also held
 * the eight-item theme picker, which meant the one high-value action ("ask
 * about this file") shared a slot with low-value chrome, and the whole popup
 * had to re-implement outside-click, Escape, and focus handling that
 * `ui/dropdown-menu.tsx` already provides.
 *
 * This is that primitive, plus one rule about what belongs in it: **only
 * actions that operate on the current file.** Viewer-level controls (insights,
 * palette) live in the command bar, not here.
 */

import { memo, useState } from "react";
import {
  Check,
  Copy,
  Keyboard,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Palette,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import type { FileIndexState } from "@/src/lib/file-index-state";
import { CODE_THEMES } from "./utils";

interface FileActionsProps {
  filePath: string;
  projectId: string;
  /** Full file body — copied verbatim. */
  content: string;
  indexState: FileIndexState;
  /** Null when asking is allowed; otherwise the reason to show instead. */
  askDisabledReason: string | null;
  isAskPending: boolean;
  onAsk: () => void;
  theme: string;
  onSelectTheme: (themeId: string) => void;
  onShowShortcuts: () => void;
}

/** Clipboard writes fail on insecure origins; a dead button is worse. */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function FileActions({
  filePath,
  projectId,
  content,
  askDisabledReason,
  isAskPending,
  onAsk,
  theme,
  onSelectTheme,
  onShowShortcuts,
}: FileActionsProps) {
  const [copied, setCopied] = useState<"content" | "path" | "link" | null>(
    null,
  );

  const flash = (kind: "content" | "path" | "link") => {
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="File actions"
        className={cn(
          "border-border/40 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-accent/50",
          "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs transition-colors outline-none",
          "focus-visible:ring-ring/70 focus-visible:ring-2 focus-visible:ring-inset",
          "data-[state=open]:bg-accent/50 data-[state=open]:text-foreground",
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Actions</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => {
              if (copied === "content") return;
              void copyText(content).then((ok) => ok && flash("content"));
            }}
          >
            {copied === "content" ? (
              <Check className="text-gv-moss" aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied === "content" ? "Copied file" : "Copy file contents"}
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => {
              void copyText(filePath).then((ok) => ok && flash("path"));
            }}
          >
            {copied === "path" ? (
              <Check className="text-gv-moss" aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            Copy path
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => {
              // The link is the shareable unit: it carries the deep-link
              // params the viewer itself reads on arrival.
              const url = `${window.location.origin}/code-viewer/${projectId}?file=${encodeURIComponent(filePath)}`;
              void copyText(url).then((ok) => ok && flash("link"));
            }}
          >
            {copied === "link" ? (
              <Check className="text-gv-moss" aria-hidden="true" />
            ) : (
              <Link2 aria-hidden="true" />
            )}
            Copy link to this file
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={askDisabledReason !== null || isAskPending}
            onSelect={onAsk}
          >
            <MessageSquare aria-hidden="true" />
            <span className="min-w-0">
              {isAskPending ? "Opening chat…" : "Ask about this file"}
              {askDisabledReason !== null && (
                <span className="text-muted-foreground block text-[11px]">
                  {askDisabledReason}
                </span>
              )}
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette aria-hidden="true" />
            Syntax theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={onSelectTheme}
            >
              {CODE_THEMES.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2.5 shrink-0 rounded-full ring-1",
                      option.type === "light"
                        ? "bg-white ring-slate-300"
                        : "bg-slate-700 ring-slate-500",
                    )}
                  />
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onSelect={onShowShortcuts}>
          <Keyboard aria-hidden="true" />
          Keyboard shortcuts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default memo(FileActions);
