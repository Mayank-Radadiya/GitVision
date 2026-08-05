"use client";

/**
 * Code Viewer — Orchestrator
 *
 * Layout: file tree sidebar (left) + Shiki code panel (right).
 * Manages selected file state and auto-selects README.md or first file.
 * Responsive: sidebar toggles on mobile.
 */

import { memo, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code,
  AlertTriangle,
  FolderTree,
  PanelLeftClose,
  PanelLeft,
  FileSearch,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  useProjectFiles,
  useFileContent,
} from "@/features/projects/hooks/use-project";
import { buildFileTree, type FileEntry } from "./utils";
import FileTree from "./file-tree";
import CodePanel from "./code-panel";

interface CodeViewerProps {
  projectId: string;
}

function CodeViewer({ projectId }: CodeViewerProps) {
  const { data, isLoading, error } = useProjectFiles(projectId);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Build tree from flat file list
  const files: FileEntry[] = useMemo(() => data?.files ?? [], [data?.files]);
  const tree = useMemo(() => buildFileTree(files), [files]);

  // Auto-select best initial file (README.md → first file)
  const autoSelectedPath = useMemo(() => {
    if (files.length === 0) return null;
    const readme = files.find((f) => f.path.toLowerCase().includes("readme"));
    return readme?.path || files[0].path;
  }, [files]);

  const activePath = selectedPath || autoSelectedPath;

  // Get content for selected file
  const selectedFile = useMemo(
    () => files.find((f) => f.path === activePath),
    [files, activePath],
  );

  const { data: fileContent } = useFileContent(projectId, selectedFile?.id);

  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Code className="h-4 w-4 text-primary" />
          </div>
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-3" />
        <p className="text-sm text-red-400">
          {error instanceof Error
            ? error.message
            : "Failed to load project files"}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between ">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Code className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Source Code
            </h2>
            <p className="text-xs text-muted-foreground">
              {data?.totalFiles || 0} files
            </p>
          </div>
        </div>

        {/* Sidebar toggle — mobile + desktop */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Hide files sidebar" : "Show files sidebar"}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs",
            "border border-border/40 bg-background/50",
            "hover:bg-accent/50 transition-colors cursor-pointer",
            "text-muted-foreground hover:text-foreground",
          )}
        >
          {sidebarOpen ? (
            <>
              <PanelLeftClose className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hide Files</span>
            </>
          ) : (
            <>
              <PanelLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Show Files</span>
            </>
          )}
        </button>
      </div>

      {/* Editor Layout */}
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border/60",
          "bg-card",
          "shadow-lg shadow-black/5",
        )}
        style={{ height: "80vh" }}
      >
        <div className="flex h-full">
          {/* File Tree Sidebar */}
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="border-r border-border/60 overflow-hidden flex-shrink-0"
              >
                <div className="h-full overflow-y-auto overflow-x-hidden w-[260px] bg-muted/30">
                  {/* Sidebar header */}
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-card px-3 py-2.5">
                    <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Explorer
                    </span>
                  </div>
                  <FileTree
                    tree={tree}
                    selectedPath={activePath}
                    onSelect={handleSelect}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Code Panel */}
          <div className="flex-1 min-w-0">
            {selectedFile ? (
              <CodePanel
                filePath={selectedFile.path}
                content={fileContent || ""}
                language={selectedFile.language}
              />
            ) : (
              /* Empty state */
              <div className="flex h-full items-center justify-center text-center p-8">
                <div>
                  <FileSearch className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Select a file from the explorer to view its content
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(CodeViewer);
