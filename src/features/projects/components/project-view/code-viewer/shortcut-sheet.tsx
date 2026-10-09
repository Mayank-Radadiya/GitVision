"use client";

/**
 * Code Viewer — shortcut sheet.
 *
 * The palette is discoverable because it is triggered by the shortcut everyone
 * already knows. These bindings are not, and several of them are invisible
 * affordances (`j`/`k`, `t`) that a reader would never guess. This sheet is the
 * only place they are documented, which is why it is reachable from the
 * overflow menu and from `?`, not just from memory.
 */

import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { CommandShortcut } from "@/shared/components/ui/command";
interface ShortcutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutRow {
  keys: string[];
  label: string;
}

const SECTIONS: { title: string; rows: ShortcutRow[] }[] = [
  {
    title: "Navigate",
    rows: [
      { keys: ["j"], label: "Next file" },
      { keys: ["k"], label: "Previous file" },
      { keys: ["↵"], label: "Open selected file" },
      { keys: ["g"], label: "First file" },
      { keys: ["G"], label: "Last file" },
    ],
  },
  {
    title: "Viewer",
    rows: [
      { keys: ["⌘", "K"], label: "Command palette" },
      { keys: ["t"], label: "Toggle index insights" },
      { keys: ["⌘", "B"], label: "Toggle file explorer" },
      { keys: ["?"], label: "This sheet" },
      { keys: ["Esc"], label: "Close" },
    ],
  },
  {
    title: "In the file tree",
    rows: [
      { keys: ["↑", "↓"], label: "Move" },
      { keys: ["→"], label: "Expand folder / enter" },
      { keys: ["←"], label: "Collapse / go to parent" },
      { keys: ["Home", "End"], label: "First / last row" },
    ],
  },
];

function ShortcutSheet({ open, onOpenChange }: ShortcutSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Everything here is also reachable from the command palette.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
                {section.title}
              </h3>
              <dl className="space-y-1">
                {section.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4"
                  >
                    <dt className="text-foreground text-xs">{row.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {row.keys.map((key, index) => (
                        <span key={`${key}-${index}`} className="flex items-center gap-1">
                          {index > 0 && (
                            <span className="text-muted-foreground/60 text-[10px]">
                              then
                            </span>
                          )}
                          <kbd className="border-border/60 bg-muted/60 text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(ShortcutSheet);
export { CommandShortcut };
