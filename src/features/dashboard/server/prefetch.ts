/**
 * Server-side prefetch for dashboard data.
 * Queries are dehydrated and rehydrated on the client via HydrateClient.
 */

import { prefetch, trpc } from "@/src/lib/trpc/server";

export function prefetchDashboard() {
  return Promise.all([
    prefetch(trpc.project.getDashboardInfo.queryOptions()),
    prefetch(trpc.project.getAll.queryOptions()),
    prefetch(trpc.project.getRecentActivity.queryOptions()),
    prefetch(trpc.project.getCommitChart.queryOptions()),
  ]);
}
