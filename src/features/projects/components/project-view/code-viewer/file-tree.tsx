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
 */

import { memo, useState, useCallback } from "react";
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
import type { TreeNode } from "./utils";

interface FileTreeProps {
  tree: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

/** Get icon for file based on language */
function getFileIcon(node: TreeNode) {
  if (node.type === "directory") return null; // handled separately

  const lang = node.language || "";
  const iconClass = "h-4 w-4 flex-shrink-0";

  switch (lang) {
    case "typescript":
    case "tsx":
    case "javascript":
    case "jsx":
    case "python":
    case "rust":
    case "go":
    case "java":
      return <FileCode className={cn(iconClass, "text-blue-400")} />;
    case "json":
      return <FileJson className={cn(iconClass, "text-yellow-400")} />;
    case "markdown":
    case "mdx":
    case "text":
      return <FileText className={cn(iconClass, "text-muted-foreground")} />;
    case "css":
    case "scss":
      return <FileCode className={cn(iconClass, "text-pink-400")} />;
    case "html":
    case "xml":
      return <FileCode className={cn(iconClass, "text-orange-400")} />;
    default:
      return <FileIcon className={cn(iconClass, "text-muted-foreground")} />;
  }
}

// ─── Directory Node ──────────────────────────────────────────────────────────

interface DirectoryNodeProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function DirectoryNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: DirectoryNodeProps) {
  // Auto-expand first level
  const [isOpen, setIsOpen] = useState(depth < 1);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div>
      <button
        onClick={toggle}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm",
          "hover:bg-accent/50 transition-colors cursor-pointer",
          "text-muted-foreground hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150",
            isOpen && "rotate-90",
          )}
        />
        {isOpen ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-primary/70" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0 text-primary/70" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </button>

      {/* Children — animated open/close */}
      {isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
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
  onSelect: (path: string) => void;
}

function FileNode({ node, depth, isSelected, onSelect }: FileNodeProps) {
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm",
        "transition-colors cursor-pointer",
        isSelected
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      {getFileIcon(node)}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ─── Recursive Node ──────────────────────────────────────────────────────────

interface TreeNodeComponentProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function TreeNodeComponent({
  node,
  depth,
  selectedPath,
  onSelect,
}: TreeNodeComponentProps) {
  if (node.type === "directory") {
    return (
      <DirectoryNode
        node={node}
        depth={depth}
        selectedPath={selectedPath}
        onSelect={onSelect}
      />
    );
  }

  return (
    <FileNode
      node={node}
      depth={depth}
      isSelected={selectedPath === node.path}
      onSelect={onSelect}
    />
  );
}

// ─── Root Component ──────────────────────────────────────────────────────────

function FileTree({ tree, selectedPath, onSelect }: FileTreeProps) {
  return (
    <div className="space-y-0.5 py-2">
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default memo(FileTree);
