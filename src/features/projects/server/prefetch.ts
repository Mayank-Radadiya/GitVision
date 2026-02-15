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
export function prefetchProject(projectId: string) {
  // Prefetch project details (standard query)
  prefetch(trpc.project.getDetails.queryOptions({ projectId }));

  // Prefetch first page of commits (standard query — initial load)
  prefetch(trpc.project.getCommits.queryOptions({ projectId, limit: 10 }));
}
