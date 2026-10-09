"use client";

/**
 * Code Viewer — command palette.
 *
 * `ui/command.tsx` already ships a `CommandDialog` built on cmdk inside a
 * Radix Dialog, so this is a list and a filter — no new dependency, and no
 * re-implementation of the modal's focus trap, Escape handling, or outside
 * click, which is what the old hand-rolled popups were quietly doing badly.
 *
 * The list is ordered by what a reader opens the palette for: jump to a file
 * first, then act on the file they are already reading. Files are ranked by
 * fuzzy match, not alphabetical order, because when you have typed
 * "commanbar" you want `command-bar.tsx` and not `api/commands.ts`.
 */

import { memo, useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/shared/components/ui/command";
import { formatCount } from "@/shared/lib/format";
import IndexDot from "./index-dot";
import type { FileEntry } from "./utils";

export interface PaletteFile {
  path: string;
  lines?: number;
  indexState?: FileEntry["indexState"];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: readonly FileEntry[];
  /** Project embedding status; the dot tooltip needs it to be truthful. */
  indexStatus: string;
  onSelectFile: (path: string) => void;
  onToggleInsights: () => void;
  onCopyPath: () => void;
  onCopyLink: () => void;
  onAsk: () => void;
  onShowShortcuts: () => void;
  /** Asking is unavailable while the file has no index; hide it then. */
  canAsk: boolean;
}

function CommandPalette({
  open,
  onOpenChange,
  files,
  indexStatus,
  onSelectFile,
  onToggleInsights,
  onCopyPath,
  onCopyLink,
  onAsk,
  onShowShortcuts,
  canAsk,
}: CommandPaletteProps) {
  // Ranked once per open. A 5,000-file repo filters instantly because the
  // expensive part is the sort, and it does not depend on the query.
  const ranked = useMemo<PaletteFile[]>(
    () =>
      files
        .map((file) => ({
          path: file.path,
          lines: file.lines,
          indexState: file.indexState,
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [files],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a file or run a viewer action"
      className="max-w-2xl"
    >
      <CommandInput placeholder="Search files by path, or type an action…" />
      <CommandList>
        <CommandEmpty>No files match that path.</CommandEmpty>

        <CommandGroup heading="Files">
          {ranked.map((file) => (
            <CommandItem
              key={file.path}
              value={`${file.path} ${file.path.split("/").pop() ?? ""}`}
              onSelect={() => {
                onSelectFile(file.path);
                onOpenChange(false);
              }}
              className="font-mono text-xs"
            >
              <IndexDot
                state={file.indexState ?? "unresolved"}
                status={indexStatus}
                dimmed
                className="me-1.5"
              />
              <span className="truncate">{file.path}</span>
              {typeof file.lines === "number" && file.lines > 0 && (
                <span className="text-muted-foreground ms-auto shrink-0 font-mono text-[10px] tabular-nums">
                  {formatCount(file.lines)}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            value="insights toggle index panel"
            onSelect={() => {
              onToggleInsights();
              onOpenChange(false);
            }}
          >
            Toggle index insights
          </CommandItem>
          {canAsk && (
            <CommandItem
              value="ask chat about this file"
              onSelect={() => {
                onAsk();
                onOpenChange(false);
              }}
            >
              Ask about this file
            </CommandItem>
          )}
          <CommandItem
            value="copy path file path clipboard"
            onSelect={() => {
              onCopyPath();
              onOpenChange(false);
            }}
          >
            Copy file path
          </CommandItem>
          <CommandItem
            value="copy link share url"
            onSelect={() => {
              onCopyLink();
              onOpenChange(false);
            }}
          >
            Copy link to this file
          </CommandItem>
          <CommandItem
            value="keyboard shortcuts help keys"
            onSelect={() => {
              onShowShortcuts();
              onOpenChange(false);
            }}
          >
            Keyboard shortcuts
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default memo(CommandPalette);
