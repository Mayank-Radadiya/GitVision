/**
 * Project View — tRPC Hooks
 *
 * Type-safe hooks for project detail page data fetching.
 * Each hook subscribes to a single concern to prevent cross-rerenders.
 *
 * Hooks:
 * - useProjectDetails: Project metadata (name, stats, URL)
 * - useProjectCommits: Paginated commit list (cursor-based)
 * - useProjectFiles: Sandpack-formatted file tree
 * - useGenerateAiSummary: AI summary mutation with optimistic updates
 */

import { trpc } from "@/src/lib/trpc/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Fetches project details by ID.
 * Stale time: 5 minutes — project metadata rarely changes.
 */
export function useProjectDetails(projectId: string) {
  return trpc.project.getDetails.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      staleTime: 5 * 60 * 1000,
      refetchInterval: (query) =>
        ["pending", "processing"].includes(
          query.state.data?.embeddingStatus ?? "",
        )
          ? 5000
          : false,
    },
  );
}

/**
 * Fetches project commits with cursor-based pagination.
 * Uses `useInfiniteQuery` pattern via tRPC's cursor support.
 */
export function useProjectCommits(projectId: string) {
  return trpc.project.getCommits.useInfiniteQuery(
    { projectId, limit: 10 },
    {
      enabled: !!projectId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 60 * 1000, // 1 minute — commits update frequently
    },
  );
}

/**
 * Per-project aggregates for the overview dashboard.
 *
 * `days` selects the window the server aggregates over, so switching 7 / 30 /
 * 90 refetches rather than re-slicing: the prior-period trend, the contributor
 * counts and the daily series all have to describe the same range, and slicing
 * one wide series client-side is exactly how they drift apart.
 *
 * Stale time is short because this is the surface whose whole job is showing
 * that something changed. `placeholderData` keeps the previous window's shape on
 * screen during the switch instead of collapsing the chart to nothing.
 */
export function useProjectInsights(projectId: string, days: 7 | 30 | 90 = 30) {
  return trpc.project.getInsights.useQuery(
    { projectId, days },
    {
      enabled: !!projectId,
      staleTime: 60 * 1000,
      placeholderData: (previous) => previous,
    },
  );
}

/**
 * Fetches project files for the code viewer (Shiki).
 * Stale time: 10 minutes — files change less often than commits.
 */
export function useProjectFiles(projectId: string) {
  return trpc.project.getFiles.useQuery(
    { projectId },
    { enabled: !!projectId, staleTime: 10 * 60 * 1000 },
  );
}

/**
 * Fetches single file code content.
 * Keeps file tree lightweight while allowing code to be loaded on demand.
 */
export function useFileContent(projectId: string, fileId: string | undefined) {
  return trpc.project.getFileContent.useQuery(
    { projectId, fileId: fileId! },
    { enabled: !!projectId && !!fileId, staleTime: Infinity },
  );
}

/**
 * AI summary generation mutation.
 * Moves the `getAiSummaryOfCommit` call server-side for security.
 * Includes optimistic update to show "Generating..." state immediately.
 */
export function useGenerateAiSummary(projectId: string) {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  return trpc.project.generateAiSummary.useMutation({
    onSuccess: () => {
      // Invalidate commit queries to refresh with new AI summary
      utils.project.getCommits.invalidate({ projectId });
    },
    onError: () => {
      // Revert optimistic update on failure
      queryClient.invalidateQueries({
        queryKey: [["project", "getCommits"]],
      });
    },
  });
}

/**
 * Fetches project issues or pull requests.
 * Stale time: 1 minute.
 */
export function useProjectIssues(projectId: string, isPullRequest: boolean) {
  return trpc.project.getIssues.useQuery(
    { projectId, isPullRequest },
    { enabled: !!projectId, staleTime: 60 * 1000 },
  );
}

/** Cursor-paged issues for the workspace. Uses the same endpoint and sync
 * invalidation as the existing query, while making older results reachable. */
export function usePaginatedProjectIssues(
  projectId: string,
  isPullRequest: boolean,
) {
  return trpc.project.getIssues.useInfiniteQuery(
    { projectId, isPullRequest, limit: 50 },
    {
      enabled: !!projectId,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
      staleTime: 60 * 1000,
    },
  );
}

/**
 * Fetches comments for a specific issue.
 * Only fetches when issueId is truthy and query is enabled (expand on demand).
 * Stale time: 2 minutes.
 */
export function useIssueComments(
  issueId: string | null,
  options?: { enabled?: boolean },
) {
  return trpc.project.getIssueComments.useQuery(
    { issueId: issueId! },
    {
      staleTime: 2 * 60 * 1000,
      ...options,
      enabled: (options?.enabled ?? true) && !!issueId,
    },
  );
}

/**
 * Re-syncs issues and pull requests from GitHub.
 * Invalidates issue/PR queries on success so the UI auto-refreshes.
 */
export function useSyncIssues(projectId: string) {
  const utils = trpc.useUtils();
  return trpc.project.syncIssues.useMutation({
    onSuccess: () => {
      utils.project.getIssues.invalidate({ projectId, isPullRequest: false });
      utils.project.getIssues.invalidate({ projectId, isPullRequest: true });
    },
  });
}

/**
 * Queues an incremental re-sync of the project's files.
 *
 * Fire-and-forget by design: the server returns as soon as the Inngest event
 * is queued, and `lastSyncedAt` is what actually reports completion. So
 * invalidating `getDetails` here refreshes the header immediately (the
 * timestamp is still the old one), and the next poll or a page reload picks
 * up the new value. Invalidating on a timer would be a guess at how long a
 * tarball takes; the staleness cron guarantees the value converges either way.
 */
export function useResyncProject(projectId: string) {
  const utils = trpc.useUtils();
  return trpc.project.resync.useMutation({
    onSuccess: () => {
      utils.project.getDetails.invalidate({ projectId });
    },
  });
}
