/**
 * Code Viewer — selection state.
 *
 * One reducer owns the rail and the tab strip, so the selected file, recent
 * files, search text, index filter, and sidebar visibility cannot disagree.
 * Storage access stays outside the reducer: it only receives already-validated
 * paths, which keeps session restores and invalid deep links testable.
 */

export type ViewerIndexFilter = "all" | "searchable" | "not-indexed";

export interface ViewerState {
  query: string;
  filter: ViewerIndexFilter;
  selectedPath: string | null;
  sidebarOpen: boolean;
  recentPaths: string[];
}

export type ViewerAction =
  | { type: "set-query"; query: string }
  | { type: "set-filter"; filter: ViewerIndexFilter }
  | { type: "select-file"; path: string; available: ReadonlySet<string> }
  | { type: "close-recent"; path: string }
  | { type: "toggle-sidebar" }
  | {
      type: "hydrate-recent";
      paths: unknown;
      available: ReadonlySet<string>;
    };

/** Recent-file memory lives here: eight entries are recall, not history. */
export const RECENT_FILE_LIMIT = 8;

export function viewerStorageKey(projectId: string): string {
  return `gitvision:viewer-recent:${projectId}`;
}

export function initialViewerState(
  seed: Partial<ViewerState> = {},
): ViewerState {
  const { recentPaths, ...rest } = seed;
  return {
    query: "",
    filter: "all",
    selectedPath: null,
    sidebarOpen: true,
    ...rest,
    recentPaths: [...(recentPaths ?? [])],
  };
}

/**
 * Keep only strings that still exist, in stored order, without duplicates.
 * Unknown or deleted paths fail closed: a stale session cannot select a file
 * the project no longer has.
 */
export function sanitizeRecentPaths(
  value: unknown,
  available: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(value)) return [];
  const paths: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    if (!available.has(candidate)) continue;
    if (paths.includes(candidate)) continue;
    paths.push(candidate);
    if (paths.length >= RECENT_FILE_LIMIT) break;
  }
  return paths;
}

/** Most recent first, capped, and pruned against the current file list. */
export function pushRecentPath(
  existing: readonly string[],
  selected: string | null,
  available: ReadonlySet<string>,
): string[] {
  if (!selected || !available.has(selected)) return [...existing];
  return [
    selected,
    ...existing.filter((path) => path !== selected && available.has(path)),
  ].slice(0, RECENT_FILE_LIMIT);
}

/** Read a validated recent list, or nothing when storage is unavailable. */
export function readRecentPaths(
  projectId: string,
  available: ReadonlySet<string>,
): string[] {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return [];
    return sanitizeRecentPaths(
      JSON.parse(window.sessionStorage.getItem(viewerStorageKey(projectId)) ?? "[]"),
      available,
    );
  } catch {
    return [];
  }
}

/** Best-effort write: private-mode storage failures must not break reading. */
export function writeRecentPaths(projectId: string, paths: string[]): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    window.sessionStorage.setItem(
      viewerStorageKey(projectId),
      JSON.stringify(paths.slice(0, RECENT_FILE_LIMIT)),
    );
  } catch {
    // Ignore quota or access errors.
  }
}

export function resolveActivePath(input: {
  files: ReadonlySet<string>;
  selectedPath: string | null;
  requestedPath: string | null;
  autoSelectedPath: string | null;
}): string | null {
  if (input.selectedPath && input.files.has(input.selectedPath)) {
    return input.selectedPath;
  }
  if (input.requestedPath && input.files.has(input.requestedPath)) {
    return input.requestedPath;
  }
  if (input.autoSelectedPath && input.files.has(input.autoSelectedPath)) {
    return input.autoSelectedPath;
  }
  return null;
}

export function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case "set-query":
      return { ...state, query: action.query };
    case "set-filter":
      return { ...state, filter: action.filter };
    case "select-file":
      if (!action.available.has(action.path)) return state;
      return {
        ...state,
        selectedPath: action.path,
        recentPaths: pushRecentPath(state.recentPaths, action.path, action.available),
      };
    case "close-recent":
      return {
        ...state,
        recentPaths: state.recentPaths.filter((path) => path !== action.path),
      };
    case "toggle-sidebar":
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case "hydrate-recent":
      return {
        ...state,
        recentPaths: sanitizeRecentPaths(action.paths, action.available),
      };
  }
}
