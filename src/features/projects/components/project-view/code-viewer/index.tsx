"use client";

/**
 * Code Viewer — Orchestrator
 *
 * Layout: file tree sidebar (left) + Shiki code panel (right).
 * Manages selected file state and auto-selects README.md or first file.
 * Responsive: sidebar toggles on mobile.
 */

import { memo, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code,
  AlertTriangle,
  FolderTree,
  PanelLeftClose,
  PanelLeft,
  FileSearch,
  Search,
} from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
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
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Build tree from flat file list
  const files: FileEntry[] = useMemo(() => data?.files ?? [], [data?.files]);
  const tree = useMemo(
    () =>
      buildFileTree(
        files.filter((file) =>
          file.path.toLowerCase().includes(search.toLowerCase()),
        ),
      ),
    [files, search],
  );

  // ─── Deep link: ?file=<path>&line=<n> from chat citation badges ─────────
  // Pure derivation, no effect: the param wins until the user picks a file,
  // and an unknown path falls through to the default below instead of
  // blanking the panel.
  const searchParams = useSearchParams();
  const fileParam = searchParams.get("file");
  const lineParam = searchParams.get("line");

  const requestedPath = useMemo(() => {
    // The RAG index and the file list may disagree on a leading "./".
    const normalized = fileParam?.replace(/^\.\//, "") ?? "";
    if (!normalized) return null;
    return files.some((f) => f.path === normalized) ? normalized : null;
  }, [fileParam, files]);

  const requestedLine = useMemo(() => {
    const n = Number(lineParam);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  }, [lineParam]);

  // Auto-select best initial file (README.md → first file)
  const autoSelectedPath = useMemo(() => {
    if (files.length === 0) return null;
    const readme = files.find((f) => f.path.toLowerCase().includes("readme"));
    return readme?.path || files[0].path;
  }, [files]);

  const activePath = selectedPath || requestedPath || autoSelectedPath;

  // The line param only describes the deep-linked file: once the user
  // clicks elsewhere it stops applying to the panel.
  const activeLine =
    activePath !== null && activePath === requestedPath
      ? requestedLine
      : undefined;

  // Get content for selected file
  const selectedFile = useMemo(
    () => files.find((f) => f.path === activePath),
    [files, activePath],
  );

  const {
    data: fileContent,
    isLoading: isFileLoading,
    isError: isFileError,
    refetch: refetchFile,
  } = useFileContent(projectId, selectedFile?.id);

  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-xl">
            <Code className="text-primary h-4 w-4" />
          </div>
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-150 w-full rounded-xl" />
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
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
      <div className="relative mb-5 max-w-md">
        <Search
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          aria-label="Search repository files"
          placeholder="Find a file by path…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
            <Code className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-semibold">
              Source Code
            </h2>
            <p className="text-muted-foreground text-xs">
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
            "border-border/40 bg-background/50 border",
            "hover:bg-accent/50 cursor-pointer transition-colors",
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
          "border-border/60 overflow-hidden rounded-xl border",
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
                className="border-border/60 shrink-0 overflow-hidden border-r"
              >
                <div className="bg-muted/30 h-full w-65 overflow-x-hidden overflow-y-auto">
                  {/* Sidebar header */}
                  <div className="border-border/60 bg-card sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2.5">
                    <FolderTree className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Explorer
                    </span>
                  </div>
                  {tree.length === 0 && (
                    <p className="text-muted-foreground p-4 text-sm">
                      {search
                        ? "No files match this path."
                        : "No files available. Sync your repository to load files."}
                    </p>
                  )}
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
          <div className="min-w-0 flex-1">
            {selectedFile && isFileLoading ? (
              <div role="status" className="space-y-4 p-6">
                <span className="sr-only">Loading file content…</span>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-80 w-full" />
              </div>
            ) : selectedFile && isFileError ? (
              <div role="alert" className="p-6">
                <p className="text-muted-foreground text-sm">
                  Couldn’t load this file.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => void refetchFile()}
                >
                  Try again
                </Button>
              </div>
            ) : selectedFile ? (
              <CodePanel
                filePath={selectedFile.path}
                content={fileContent || ""}
                language={selectedFile.language}
                projectId={projectId}
                highlightLine={activeLine}
              />
            ) : (
              /* Empty state */
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <FileSearch className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground text-sm">
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
