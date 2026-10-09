"use client";

/**
 * Code Viewer — orchestrator.
 *
 * Third generation of this component. What changed, and why:
 *
 *   - **Height is a prop, not a constant.** Both mounts used to impose
 *     `80vh / min 540px` on themselves, which inside the workspace "files" tab
 *     produced a second scrollbar nested inside the first. `fill` resolves the
 *     two contexts: `page` lets the route shell own the viewport height,
 *     `embedded` takes a fixed slot that cannot exceed its container.
 *   - **The URL is the state.** Selecting a file replaces `?file=`, so the
 *     back button, link sharing, and a reload all work. Chat citations
 *     already arrived this way; they were simply never maintained afterwards.
 *   - **One chrome row.** The old three (breadcrumb, facts, tab strip) became
 *     two: the tab strip stays on the code pane and the command bar absorbs
 *     the other two.
 *   - **Navigation is not mouse-only.** `j/k/Enter/g/G/t/?` plus ⌘K, all gated
 *     so nothing fires while the reader is typing in the filter box.
 *
 * The reducer, the tree, the highlight pipeline, and the index vocabulary are
 * unchanged on purpose — they are correct, heavily tested, and orthogonal to
 * the layout, so treating them as a dependency rather than a rewrite target
 * is what keeps this change reviewable.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AlertTriangle, FileCode2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { formatCount } from "@/shared/lib/format";
import { describeFileIndex } from "@/src/lib/file-index-state";
import {
  useFileContent,
  useIndexedProjectFiles,
} from "@/features/projects/hooks/use-project";
import { trpc } from "@/src/lib/trpc/client";
import CodeCommandBar, { type FileFacts } from "./code-command-bar";
import CodeSurface from "./code-surface";
import CommandPalette from "./command-palette";
import ExplorerRail from "./explorer-rail";
import FileActions from "./file-actions";
import InsightsDrawer from "./insights-drawer";
import InstrumentStrip from "./instrument-strip";
import ShortcutSheet from "./shortcut-sheet";
import TabStrip from "./tab-strip";
import { useShikiTheme } from "./use-shiki-theme";
import { isTypingTarget, resolveViewerCommand } from "./viewer-keys";
import {
  applyIndexFilter,
  buildFileTree,
  filterViewerFiles,
  summarizeIndexedFiles,
  type FileEntry,
} from "./utils";
import {
  formatViewerStrip,
  type ViewerIndexProject,
} from "./file-stats";
import {
  initialViewerState,
  readRecentPaths,
  resolveActivePath,
  viewerReducer,
  writeRecentPaths,
} from "./viewer-state";
import type { ViewerTab } from "./tab-strip";

// ─── Layout constants ────────────────────────────────────────────────────────

const RAIL_WIDTH = 280;

/**
 * The viewer fills the height it is given rather than inventing one. The route
 * mount passes `fill="page"` alongside a `100dvh` shell; the workspace tab uses
 * the default and gets a fixed slot. Neither value is allowed to make the code
 * area scroll the page itself.
 */
type ViewerFill = "page" | "embedded";

const FILL_CLASS: Record<ViewerFill, string> = {
  page: "h-full min-h-0",
  embedded: "h-[640px] lg:h-[720px]",
};

interface CodeViewerProps {
  projectId: string;
  /** `"page"` only for the route mount; the workspace tab uses the default. */
  fill?: ViewerFill;
}

/** RAG paths sometimes carry a `./` prefix; the index does not store one. */
function normalizePath(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("./") ? trimmed.slice(2) : trimmed;
}

function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1024;
}

export default function CodeViewer({
  projectId,
  fill = "embedded",
}: CodeViewerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [state, dispatch] = useReducer(viewerReducer, undefined, () =>
    initialViewerState(),
  );
  const [railOpen, setRailOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [lineTarget, setLineTarget] = useState<{
    path: string;
    line: number;
  } | null>(null);
  const { theme, selectTheme } = useShikiTheme();

  // ─── Data ────────────────────────────────────────────────────────────────
  const filesQuery = useIndexedProjectFiles(projectId);
  const files = useMemo<FileEntry[]>(
    () => (filesQuery.data?.files ?? []) as FileEntry[],
    [filesQuery.data],
  );
  const project = filesQuery.data?.project as ViewerIndexProject | undefined;
  const projectStatus = project?.status ?? "pending";

  const available = useMemo(
    () => new Set(files.map((file) => file.path)),
    [files],
  );

  // ─── Filtering ───────────────────────────────────────────────────────────
  const summary = useMemo(() => summarizeIndexedFiles(files), [files]);
  const counts = useMemo(
    () => ({
      all: files.length,
      searchable: summary.indexed,
      notIndexed: summary.notIndexed,
    }),
    [files.length, summary.indexed, summary.notIndexed],
  );
  const matched = useMemo(
    () => filterViewerFiles(files, state.query),
    [files, state.query],
  );
  const filtered = useMemo(
    () => applyIndexFilter(matched, state.filter),
    [matched, state.filter],
  );
  const tree = useMemo(() => buildFileTree(filtered), [filtered]);
  const strip = useMemo(
    () =>
      formatViewerStrip(summary, {
        status: project?.status ?? "pending",
        repoFileCount: project?.repoFileCount ?? null,
        estimatedTokens: project?.estimatedTokens ?? null,
      }),
    [summary, project],
  );

  // The tab strip takes view models, not raw paths: a recent list of 8 needs
  // the same truncation rules as the tree, and building them once here keeps
  // that rule in one place.
  const tabs = useMemo<ViewerTab[]>(
    () =>
      state.recentPaths.map((path) => {
        const name = path.split("/").pop() ?? path;
        const parent = path.slice(0, path.length - name.length - 1) || undefined;
        return { path, name, parent };
      }),
    [state.recentPaths],
  );

  // ─── Recents: hydrate once, then persist on change ─────────────────────────
  const hydratedFor = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (hydratedFor.current === projectId || available.size === 0) return;
    hydratedFor.current = projectId;
    dispatch({
      type: "hydrate-recent",
      paths: readRecentPaths(projectId, available),
      available,
    });
  }, [projectId, available]);

  useEffect(() => {
    if (state.recentPaths.length === 0) return;
    writeRecentPaths(projectId, state.recentPaths);
  }, [projectId, state.recentPaths]);

  // ─── Selection ───────────────────────────────────────────────────────────
  const requestedPath = normalizePath(searchParams?.get("file") ?? null);
  const deepLinkLine = Number(searchParams?.get("line") ?? "");
  const hasDeepLinkLine = Number.isFinite(deepLinkLine) && deepLinkLine > 0;

  const autoSelectedPath = useMemo(
    () =>
      files.find((file) => /(^|\/)readme\.md$/i.test(file.path))?.path ??
      files[0]?.path ??
      null,
    [files],
  );

  const selectedPath = resolveActivePath({
    files: available,
    selectedPath: state.selectedPath,
    requestedPath,
    autoSelectedPath,
  });

  const activeFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath],
  );

  const contentQuery = useFileContent(projectId, activeFile?.id);
  const content = contentQuery.data ?? "";

  // ─── Deep link line: applies while that file is the active one ────────────
  useEffect(() => {
    if (!hasDeepLinkLine || !requestedPath) return;
    setLineTarget({ path: requestedPath, line: Math.floor(deepLinkLine) });
  }, [requestedPath, hasDeepLinkLine, deepLinkLine]);

  const activeLine =
    lineTarget?.path === selectedPath ? lineTarget.line : undefined;

  // ─── Actions ─────────────────────────────────────────────────────────────
  const selectFile = useCallback(
    (path: string) => {
      dispatch({ type: "select-file", path, available });
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.set("file", path);
      // `replace`, not `push`: every click would otherwise become a history
      // entry, and leaving the viewer would take five presses of back.
      router.replace(`?${next.toString()}`, { scroll: false });
      if (isNarrowViewport()) setRailOpen(false);
    },
    [available, router, searchParams],
  );

  const facts: FileFacts | null = useMemo(() => {
    if (!activeFile) return null;
    return {
      lines: activeFile.lines ?? 0,
      bytes: activeFile.bytes ?? 0,
      chunks: activeFile.chunkCount ?? 0,
      tokens: activeFile.tokenCount ?? 0,
      indexState: activeFile.indexState ?? "not-indexed",
      status: projectStatus,
    };
  }, [activeFile, projectStatus]);

  const indexDescription = useMemo(
    () =>
      facts
        ? describeFileIndex({
            chunkCount: facts.chunks,
            tokenCount: facts.tokens,
            status: facts.status,
          })
        : null,
    [facts],
  );

  const askMutation = trpc.chat.create.useMutation({
    onSuccess: (chat) => {
      router.push(
        `/chat/${chat.id}?file=${encodeURIComponent(activeFile?.path ?? "")}`,
      );
    },
  });

  const ask = useCallback(() => {
    if (!activeFile) return;
    if (indexDescription?.askDisabledReason) return;
    askMutation.mutate({
      type: "project",
      projectId,
      title: "File review",
    });
  }, [activeFile, indexDescription, askMutation, projectId]);

  const copyText = useCallback(async (value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // Clipboard is unavailable on insecure origins; nothing to recover.
    }
  }, []);

  const copyPath = useCallback(() => {
    if (activeFile) void copyText(activeFile.path);
  }, [activeFile, copyText]);

  const copyLink = useCallback(() => {
    if (!activeFile) return;
    void copyText(
      `${window.location.origin}/code-viewer/${projectId}?file=${encodeURIComponent(activeFile.path)}`,
    );
  }, [activeFile, copyText, projectId]);

  const railProps = useMemo(
    () => ({
      query: state.query,
      onQueryChange: (value: string) => dispatch({ type: "set-query", query: value }),
      filter: state.filter,
      onFilterChange: (next: typeof state.filter) =>
        dispatch({ type: "set-filter", filter: next }),
      counts,
      tree,
      visibleCount: filtered.length,
      totalCount: files.length,
      selectedPath: selectedPath ?? "",
      onSelectFile: selectFile,
      onClose: () => setRailOpen(false),
      onOpenPalette: () => setPaletteOpen(true),
      indexStatus: projectStatus,
    }),
    [
      state.query,
      state.filter,
      counts,
      tree,
      filtered.length,
      files.length,
      selectedPath,
      selectFile,
      projectStatus,
    ],
  );

  // ─── Keyboard ────────────────────────────────────────────────────────────
  //
  // The binding table and the resolution rules live in `viewer-keys.ts` so the
  // shortcut sheet and this effect cannot drift apart, and so the two cases
  // that matter — "the reader is typing" and "a browser chord is pressed" —
  // are assertable without mounting the viewer.
  //
  // Arrows, Home, End, and Enter are deliberately absent. The file tree owns
  // them under the WAI-ARIA tree contract, and a second global owner for the
  // same keys would make focus the hidden variable.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = resolveViewerCommand({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        typing: isTypingTarget(event.target),
      });
      if (!command) return;

      // cmdk and the shortcut sheet close on Escape and swallow their own
      // keys; while either is open the only viewer chord worth honouring is
      // the one that will dismiss it.
      switch (command) {
        case "open-palette":
          event.preventDefault();
          setPaletteOpen((open) => !open);
          break;
        case "toggle-rail":
          event.preventDefault();
          setRailOpen((open) => !open);
          break;
        case "focus-search":
          event.preventDefault();
          setRailOpen(true);
          // The rail animates in; focusing the input only makes sense once
          // it is actually there to receive focus.
          requestAnimationFrame(() => searchRef.current?.focus());
          break;
        case "toggle-insights":
          event.preventDefault();
          setInsightsOpen((open) => !open);
          break;
        case "show-shortcuts":
          event.preventDefault();
          setShortcutsOpen(true);
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hasFiles = files.length > 0;

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2 }}>
      <div
        className={cn(
          "border-border/60 bg-card/40 flex w-full flex-1 overflow-hidden",
          fill === "page"
            ? "min-h-0"
            : `h-[640px] rounded-xl border lg:h-[720px]`,
        )}
      >
        {/* ─── Pane 1: explorer ────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {railOpen && (
            <motion.aside
              key="explorer-rail"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: RAIL_WIDTH, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Project files"
              className="border-border/60 bg-card relative hidden shrink-0 overflow-hidden border-e lg:block"
            >
              <ExplorerRail {...railProps} searchRef={searchRef} />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ─── Pane 2: code ───────────────────────────────────────────── */}
        <section
          aria-label="Code"
          className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          {filesQuery.isLoading ? (
            <ViewerSkeleton />
          ) : filesQuery.isError ? (
            <ViewerError
              message="Could not load the files for this project."
              onRetry={() => void filesQuery.refetch()}
              isRetrying={filesQuery.isFetching}
            />
          ) : !hasFiles ? (
            <ViewerEmpty />
          ) : !activeFile ? (
            <ViewerEmpty
              hasFiles
              onPick={selectFile}
              suggestions={heaviestPaths(files)}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <TabStrip
                tabs={tabs}
                activePath={selectedPath}
                onSelect={selectFile}
                onClose={(path) => dispatch({ type: "close-recent", path })}
              />

              <CodeCommandBar
                filePath={activeFile.path}
                facts={facts as FileFacts}
                indexLabel={indexDescription?.label ?? ""}
                askDisabledReason={indexDescription?.askDisabledReason ?? null}
                isAskPending={askMutation.isPending}
                onAsk={ask}
                onSelectFolder={(prefix) =>
                  dispatch({ type: "set-query", query: prefix })
                }
                insightsOpen={insightsOpen}
                onToggleInsights={() => setInsightsOpen((open) => !open)}
                actions={
                  <FileActions
                    filePath={activeFile.path}
                    projectId={projectId}
                    content={content}
                    indexState={facts?.indexState ?? "not-indexed"}
                    askDisabledReason={
                      indexDescription?.askDisabledReason ?? null
                    }
                    isAskPending={askMutation.isPending}
                    onAsk={ask}
                    theme={theme}
                    onSelectTheme={selectTheme}
                    onShowShortcuts={() => setShortcutsOpen(true)}
                  />
                }
              />

              {contentQuery.isLoading ? (
                <ViewerSkeleton variant="code" />
              ) : contentQuery.isError ? (
                <ViewerError
                  compact
                  message="Could not load this file."
                  onRetry={() => void contentQuery.refetch()}
                  isRetrying={contentQuery.isFetching}
                />
              ) : (
                <CodeSurface
                  content={content}
                  language={activeFile.language || "text"}
                  theme={theme}
                  highlightLine={activeLine}
                  lineCount={facts?.lines ?? 0}
                />
              )}
            </div>
          )}

          {/* The instrument strip is the code pane's status line, not a chrome
              row: it sits below the code, and its raw "N files" caption is the
              single element in this tree carrying that exact text. */}
          {hasFiles && (
            <InstrumentStrip
              strip={strip}
              summary={summary}
              progress={project?.progress ?? null}
              onShowInsights={() => setInsightsOpen(true)}
            />
          )}
        </section>

        {/* ─── Pane 3: insights, opt-in ───────────────────────────────── */}
        <InsightsDrawer
          open={insightsOpen}
          onClose={() => setInsightsOpen(false)}
          files={files}
          summary={summary}
          repoFileCount={project?.repoFileCount ?? null}
          facts={facts}
          indexDetail={indexDescription?.detail ?? ""}
          onSelectFile={selectFile}
        />

        {/* ─── Mobile explorer sheet ───────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {railOpen && (
            <motion.div
              key="rail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setRailOpen(false)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {railOpen && (
            <motion.aside
              key="rail-sheet"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Project files"
              className="border-border/60 bg-card fixed inset-y-0 start-0 z-50 w-72 overflow-hidden border-e lg:hidden"
            >
              <ExplorerRail {...railProps} searchRef={searchRef} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        files={files}
        indexStatus={projectStatus}
        onSelectFile={selectFile}
        onToggleInsights={() => setInsightsOpen((open) => !open)}
        onCopyPath={copyPath}
        onCopyLink={copyLink}
        onAsk={ask}
        onShowShortcuts={() => setShortcutsOpen(true)}
        canAsk={indexDescription?.askDisabledReason == null}
      />
      <ShortcutSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </MotionConfig>
  );
}

/** The files most likely to be wanted first: heaviest by index tokens. */
function heaviestPaths(files: readonly FileEntry[]): string[] {
  return files
    .slice()
    .sort((a, b) => (b.tokenCount ?? 0) - (a.tokenCount ?? 0))
    .slice(0, 3)
    .map((file) => file.path);
}

/**
 * Loading skeleton that matches the real layout. A generic block skeleton
 * forces the reader to re-learn the page when it resolves; this one keeps
 * every region in place so the swap is a fill-in rather than a reflow.
 */
function ViewerSkeleton({ variant = "full" }: { variant?: "full" | "code" }) {
  const rows = variant === "code" ? 18 : 14;
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-0 flex-1",
        variant === "code" ? "bg-muted/20 p-4" : "gap-0",
      )}
    >
      <span className="sr-only">
        {variant === "code" ? "Loading file…" : "Loading repository files…"}
      </span>
      {variant === "full" && (
        <div className="border-border/60 bg-card hidden w-[280px] shrink-0 border-e lg:block" />
      )}
      <div className="flex-1 space-y-2">
        {variant === "full" && (
          <div className="bg-muted/50 h-6 w-64 animate-pulse rounded" />
        )}
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex gap-4"
            style={{ opacity: 1 - index * 0.05 }}
          >
            <div className="bg-muted/50 h-4 w-8 animate-pulse rounded" />
            <div
              className="bg-muted/30 h-4 animate-pulse rounded"
              style={{ width: `${30 + ((index * 37) % 50)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewerError({
  message = "Could not load the files for this project.",
  onRetry,
  isRetrying = false,
  compact = false,
}: {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 text-center",
        compact ? "p-6" : "p-8",
      )}
    >
      <AlertTriangle className="text-gv-ember h-5 w-5" aria-hidden="true" />
      <p className="text-foreground text-sm">{message}</p>
      <p className="text-muted-foreground max-w-sm text-xs">
        The index is unavailable right now. Retrying re-reads the same project.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={isRetrying}
        className="gap-1.5"
      >
        {isRetrying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Try again
      </Button>
    </div>
  );
}

function ViewerEmpty({
  hasFiles = false,
  onPick,
  suggestions = [],
}: {
  hasFiles?: boolean;
  onPick?: (path: string) => void;
  suggestions?: string[];
}) {
  if (!hasFiles) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Sparkles className="text-muted-foreground/50 h-5 w-5" aria-hidden="true" />
        <p className="text-foreground text-sm">No files stored yet</p>
        <p className="text-muted-foreground max-w-sm text-xs">
          Files are copied during ingestion. Binary files, files over 1 MB,
          dependencies, and ignored paths are skipped, so a young project may
          have nothing here yet.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-foreground text-sm">Pick a file to read</p>
      {suggestions.length > 0 && onPick ? (
        <div className="w-full max-w-sm space-y-1">
          <p className="text-muted-foreground text-xs">
            Start with the heaviest in the index:
          </p>
          {suggestions.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => onPick(path)}
              className="border-border/50 hover:bg-accent/40 flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-left font-mono text-[11px] transition-colors outline-none focus-visible:ring-ring/70 focus-visible:ring-2"
            >
              <FileCode2 className="text-muted-foreground h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{path}</span>
              <kbd className="border-border/60 bg-muted/60 text-muted-foreground shrink-0 rounded border px-1 font-mono text-[9px]">
                ⌘K
              </kbd>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Press ⌘K to jump to a file.
        </p>
      )}
    </div>
  );
}
