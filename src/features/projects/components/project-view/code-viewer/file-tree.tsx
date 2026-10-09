"use client";

/**
 * File Tree — Recursive collapsible sidebar for code viewer.
 *
 * Features:
 * - Recursive directory rendering with expand/collapse
 * - File type icons (Lucide)
 * - Active file highlight
 * - Sorted: directories first, then files alphabetically
 * - Memoized to prevent rerenders during code panel updates
 * - Follows the WAI-ARIA tree pattern: one tab stop for the whole tree
 *   (roving tabindex) with the arrow keys moving between rows
 */

import { memo, useState, useCallback, useRef, type KeyboardEvent } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File as FileIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { formatCount } from "@/shared/lib/format";
import { describeFileIndex } from "@/src/lib/file-index-state";
import IndexDot from "./index-dot";
import type { TreeNode } from "./utils";

interface FileTreeProps {
  tree: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** Project embedding status — feeds the per-row index tooltips. */
  indexStatus?: string;
}

/** Shared by the tree and every row: a row is focusable, not its button. */
const ROW_CLASS =
  "outline-none focus-visible:ring-ring/70 rounded-md focus-visible:ring-2 focus-visible:ring-inset";

/**
 * Icon for a file, chosen from its language.
 *
 * These carry no information a reader can reach only here: the glyph varies by
 * broad kind and the filename extension is on screen next to it. Colour alone
 * separates the eight code languages, and it is decoration, so the icons are
 * hidden from assistive technology rather than announced as an unlabelled
 * "code file".
 */
function getFileIcon(node: TreeNode) {
  if (node.type === "directory") return null; // handled separately

  const lang = node.language || "";
  const iconClass = "h-4 w-4 shrink-0";

  switch (lang) {
    case "typescript":
    case "tsx":
    case "javascript":
    case "jsx":
    case "python":
    case "rust":
    case "go":
    case "java":
      return (
        <FileCode
          aria-hidden="true"
          className={cn(iconClass, "text-primary")}
        />
      );
    case "json":
      return (
        <FileJson
          aria-hidden="true"
          className={cn(iconClass, "text-primary")}
        />
      );
    case "markdown":
    case "mdx":
    case "text":
      return (
        <FileText
          aria-hidden="true"
          className={cn(iconClass, "text-muted-foreground")}
        />
      );
    case "css":
    case "scss":
      return (
        <FileCode
          aria-hidden="true"
          className={cn(iconClass, "text-primary")}
        />
      );
    case "html":
    case "xml":
      return (
        <FileCode
          aria-hidden="true"
          className={cn(iconClass, "text-primary")}
        />
      );
    default:
      return (
        <FileIcon
          aria-hidden="true"
          className={cn(iconClass, "text-muted-foreground")}
        />
      );
  }
}

/**
 * Directory tooltips describe the folder's files, not the folder: the
 * per-file detail copy ("Indexed · N chunks") would misdescribe an aggregate.
 */
function directoryIndexTitle(
  state: TreeNode["indexState"],
): string | undefined {
  switch (state) {
    case "indexed":
      return "Every file in this folder is searchable";
    case "skipped":
      return "Files in this folder were skipped by the index run";
    case "not-indexed":
      return "Files in this folder are not indexed";
    default:
      return undefined;
  }
}

// ─── Directory Node ──────────────────────────────────────────────────────────

interface DirectoryNodeProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  activePath: string | null;
  onActivePath: (path: string) => void;
  onSelect: (path: string) => void;
  indexStatus: string;
}

function DirectoryNode({
  node,
  depth,
  selectedPath,
  activePath,
  onActivePath,
  onSelect,
  indexStatus,
}: DirectoryNodeProps) {
  // Auto-expand first level, plus every ancestor of the selected file so a
  // ?file= deep link into a nested path renders its row instead of
  // selecting a node hidden inside a collapsed folder.
  const [isOpen, setIsOpen] = useState(
    depth < 1 || selectedPath?.startsWith(node.path + "/") === true,
  );

  const toggle = useCallback(() => {
    // Toggling takes the tab stop with it, so collapsing a subtree never
    // leaves the tree with the stop on an unmounted row.
    onActivePath(node.path);
    setIsOpen((prev) => !prev);
  }, [node.path, onActivePath]);

  return (
    <div
      role="treeitem"
      aria-expanded={isOpen}
      data-path={node.path}
      tabIndex={activePath === node.path ? 0 : -1}
      className={ROW_CLASS}
    >
      <button
        onClick={toggle}
        className="hover:bg-accent/50 text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
            isOpen && "rotate-90",
          )}
        />
        {isOpen ? (
          <FolderOpen
            aria-hidden="true"
            className="text-primary/70 h-4 w-4 shrink-0"
          />
        ) : (
          <Folder
            aria-hidden="true"
            className="text-primary/70 h-4 w-4 shrink-0"
          />
        )}
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto flex shrink-0 items-center pl-2">
          <IndexDot
            state={node.indexState ?? "not-indexed"}
            status={indexStatus}
            dimmed
            title={directoryIndexTitle(node.indexState)}
          />
        </span>
      </button>

      {/* Children — animated open/close */}
      {isOpen && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              activePath={activePath}
              onActivePath={onActivePath}
              onSelect={onSelect}
              indexStatus={indexStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File Node ───────────────────────────────────────────────────────────────

interface FileNodeProps {
  node: TreeNode;
  depth: number;
  isSelected: boolean;
  activePath: string | null;
  onActivePath: (path: string) => void;
  onSelect: (path: string) => void;
  indexStatus: string;
}

function FileNode({
  node,
  depth,
  isSelected,
  activePath,
  onActivePath,
  onSelect,
  indexStatus,
}: FileNodeProps) {
  const description = describeFileIndex({
    chunkCount: node.chunkCount ?? 0,
    tokenCount: node.tokenCount ?? 0,
    status: indexStatus,
  });
  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      data-path={node.path}
      tabIndex={activePath === node.path ? 0 : -1}
      className={ROW_CLASS}
    >
      <button
        onClick={() => {
          onActivePath(node.path);
          onSelect(node.path);
        }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {getFileIcon(node)}
        <span className="truncate">{node.name}</span>
        <span className="sr-only">, {description.label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {/* Line count is the one per-file fact a reader can act on before
              opening the file: it separates a 12-line util from a 900-line
              module without a round trip. */}
          {(node.lines ?? 0) > 0 && (
            <span
              className="text-muted-foreground/60 hidden font-mono text-[11px] tabular-nums sm:inline"
              title={`${formatCount(node.lines ?? 0)} lines`}
            >
              {formatCount(node.lines ?? 0)}
            </span>
          )}
          <IndexDot
            state={node.indexState ?? "not-indexed"}
            chunks={node.chunkCount}
            tokens={node.tokenCount}
            status={indexStatus}
          />
        </span>
      </button>
    </div>
  );
}

// ─── Recursive Node ──────────────────────────────────────────────────────────

interface TreeNodeComponentProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  activePath: string | null;
  onActivePath: (path: string) => void;
  onSelect: (path: string) => void;
  indexStatus: string;
}

function TreeNodeComponent({
  node,
  depth,
  selectedPath,
  activePath,
  onActivePath,
  onSelect,
  indexStatus,
}: TreeNodeComponentProps) {
  if (node.type === "directory") {
    return (
      <DirectoryNode
        node={node}
        depth={depth}
        selectedPath={selectedPath}
        activePath={activePath}
        onActivePath={onActivePath}
        onSelect={onSelect}
        indexStatus={indexStatus}
      />
    );
  }

  return (
    <FileNode
      node={node}
      depth={depth}
      isSelected={selectedPath === node.path}
      activePath={activePath}
      onActivePath={onActivePath}
      onSelect={onSelect}
      indexStatus={indexStatus}
    />
  );
}

// ─── Root Component ──────────────────────────────────────────────────────────

function FileTree({
  tree,
  selectedPath,
  onSelect,
  indexStatus = "pending",
}: FileTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Roving tabindex: one row is in the tab order, so the tree is a single tab
  // stop and the arrow keys move within it. The stop follows the selection
  // until the user moves it, so a ?file= deep link lands the tab stop on
  // the linked file instead of the root.
  const [activePath, setActivePath] = useState<string | null>(null);
  const tabStop = activePath ?? selectedPath ?? tree[0]?.path ?? null;

  // Collapsed subtrees are unmounted, so the rendered order is the visible one.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      '[role="treeitem"]',
    );
    if (!container || !row) return;

    const rows = Array.from(
      container.querySelectorAll<HTMLElement>('[role="treeitem"]'),
    );
    const index = rows.indexOf(row);
    if (index === -1) return;

    const moveTo = (next: HTMLElement | undefined) => {
      if (!next) return;
      event.preventDefault();
      setActivePath(next.dataset.path ?? null);
      next.focus();
    };
    const step = (delta: number) =>
      moveTo(rows[Math.min(Math.max(index + delta, 0), rows.length - 1)]);
    // The row's own button is the first one in the subtree, so this activates
    // the row without descending into its children.
    const activate = () => {
      event.preventDefault();
      row.querySelector("button")?.click();
    };

    switch (event.key) {
      // `j`/`k`/`g`/`G` are aliases for the WAI-ARIA tree keys above, so a
      // reader who lives in a terminal can drive the explorer the same way.
      // They deliberately do nothing when a modifier is held: the viewer's
      // own `⌘K` and the browser's chords own those.
      case "ArrowDown":
      case "j":
        step(1);
        break;
      case "ArrowUp":
      case "k":
        step(-1);
        break;
      case "Home":
      case "g":
        moveTo(rows[0]);
        break;
      case "End":
      case "G":
        moveTo(rows[rows.length - 1]);
        break;
      case "ArrowRight":
        if (row.getAttribute("aria-expanded") === "false") activate();
        else step(1);
        break;
      case "ArrowLeft": {
        if (row.getAttribute("aria-expanded") === "true") {
          activate();
          break;
        }
        const parent =
          row.parentElement?.closest<HTMLElement>('[role="treeitem"]');
        moveTo(parent && rows.includes(parent) ? parent : undefined);
        break;
      }
      case "Enter":
      case " ":
        activate();
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="Project files"
      onKeyDown={handleKeyDown}
      className="space-y-0.5 py-2"
    >
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          activePath={tabStop}
          onActivePath={setActivePath}
          onSelect={onSelect}
          indexStatus={indexStatus}
        />
      ))}
    </div>
  );
}

export default memo(FileTree);
