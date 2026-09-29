/**
 * Project View — Server-Side Prefetch
 *
 * Prefetches project details and initial commits on the server
 * so the page renders with data immediately (no loading flash).
 *
 * Called from the server component page.tsx before hydrating the client.
 * Uses the `prefetch()` utility from `trpc/server.tsx` which handles
 * both standard and infinite queries automatically.
 */

import { trpc, prefetch } from "@/src/lib/trpc/server";

/**
 * Prefetches project data for the detail page.
 * Runs on the server before the client component mounts.
 */
export async function prefetchProject(projectId: string) {
  // The caller must await this before `HydrateClient` dehydrates, or the
  // page ships an empty cache and refetches everything on the client.
  await Promise.all([
    // Project details (standard query)
    prefetch(trpc.project.getDetails.queryOptions({ projectId })),

    // First page of commits (initial load)
    prefetch(trpc.project.getCommits.queryOptions({ projectId, limit: 10 })),

    // Issues + pull requests so tabs render instantly (no loading flash)
    prefetch(
      trpc.project.getIssues.queryOptions({
        projectId,
        isPullRequest: false,
      }),
    ),
    prefetch(
      trpc.project.getIssues.queryOptions({
        projectId,
        isPullRequest: true,
      }),
    ),
  ]);
}
