/**
 * Code Viewer — Project Selection Page (Server Component)
 * Prefetches projects via tRPC, renders a grid of project cards.
 * Each card navigates to /code-viewer/[projectId].
 */

import { prefetch, trpc, HydrateClient } from "@/src/lib/trpc/server";
import CodeViewerProjectGrid from "@/features/projects/components/code-viewer-project-grid";

export default async function CodeViewerPage() {
  prefetch(trpc.project.getAll.queryOptions());

  return (
    <HydrateClient>
      <CodeViewerProjectGrid />
    </HydrateClient>
  );
}
