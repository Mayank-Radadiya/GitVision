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

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function UserProjectPage({ params }: PageProps) {
  const { projectId } = await params;

  // Prefetch project data on the server (details + initial commits)
  prefetchProject(projectId);

  return (
    <HydrateClient>
      <ProjectPage />
    </HydrateClient>
  );
}
