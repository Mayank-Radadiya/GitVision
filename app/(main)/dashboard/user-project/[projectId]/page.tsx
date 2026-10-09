/**
 * User Project Page — Server Component
 *
 * Prefetches project data via tRPC server caller,
 * then hydrates the client component with cached data.
 * The client component manages its own state and UI.
 */

import { prefetchProject } from "@/features/projects/server/prefetch";
import { HydrateClient } from "@/src/lib/trpc/server";
import ProjectPage from "@/features/projects/components/project-view/project-page";
import { Suspense } from "react";
import WorkspaceSkeleton from "@/features/projects/components/project-view/workspace-skeleton";
import { readWorkspaceLocation } from "@/features/projects/components/project-view/workspace-navigation";

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UserProjectPage({
  params,
  searchParams,
}: PageProps) {
  const { projectId } = await params;
  const search = await searchParams;
  const location = readWorkspaceLocation({
    get: (key) => {
      const value = search[key];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  });

  // Hydrate shared metadata and the selected section before rendering.
  // Must settle before `HydrateClient` dehydrates, or the client refetches it all.
  await prefetchProject(projectId, location);

  return (
    <HydrateClient>
      <Suspense fallback={<WorkspaceSkeleton />}>
        <ProjectPage key={projectId} />
      </Suspense>
    </HydrateClient>
  );
}
