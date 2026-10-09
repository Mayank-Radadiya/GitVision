/**
 * Project View — Server-Side Prefetch
 *
 * Hydrates shared project details and insights plus the requested section.
 * Infinite-query inputs match the client hooks to avoid duplicate fetching.
 *
 * Called from the server component page.tsx before hydrating the client.
 * Uses the `prefetch()` utility from `trpc/server.tsx` which handles
 * both standard and infinite queries automatically.
 */

import { trpc, prefetch } from "@/src/lib/trpc/server";
import type { WorkspaceLocation } from "../components/project-view/workspace-navigation";

/**
 * Prefetches project data for the detail page.
 * Runs on the server before the client component mounts.
 */
export async function prefetchProject(
  projectId: string,
  location: WorkspaceLocation = { section: "overview", days: 30 },
) {
  // The caller must await this before `HydrateClient` dehydrates, or the
  // page ships an empty cache and refetches everything on the client.
  const queries = [
    // Project details (standard query)
    prefetch(trpc.project.getDetails.queryOptions({ projectId })),

    prefetch(
      trpc.project.getInsights.queryOptions({ projectId, days: location.days }),
    ),
  ];
  if (location.section === "commits")
    queries.push(
      // First page of commits. The client hook is `useInfiniteQuery`, which tags
      // the key `type: "infinite"` and strips the cursor, so a plain
      // `queryOptions` prefetch can never match it.
      prefetch(
        trpc.project.getCommits.infiniteQueryOptions(
          { projectId, limit: 10 },
          { getNextPageParam: (lastPage) => lastPage.nextCursor },
        ),
      ),
    );
  if (location.section === "issues" || location.section === "pull-requests")
    queries.push(
      prefetch(
        trpc.project.getIssues.infiniteQueryOptions(
          {
            projectId,
            isPullRequest: location.section === "pull-requests",
            limit: 50,
          },
          { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
      ),
    );
  await Promise.all(queries);
}
