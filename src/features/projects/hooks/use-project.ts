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
    { enabled: !!projectId, staleTime: 5 * 60 * 1000 },
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
