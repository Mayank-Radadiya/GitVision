/**
 * Dashboard Page (Server Component)
 * Prefetches data via tRPC server caller, then hydrates client component
 */

import { prefetchDashboard } from "@/features/dashboard/server/prefetch";
import { HydrateClient } from "@/src/lib/trpc/server";
import DashboardContent from "@/features/dashboard/components/dashboard-page";

export default async function DashboardPage() {
  prefetchDashboard();

  return (
    <HydrateClient>
      <DashboardContent />
    </HydrateClient>
  );
}
