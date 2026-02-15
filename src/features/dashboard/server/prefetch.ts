/**
 * Server-side prefetch for dashboard data.
 * Queries are dehydrated and rehydrated on the client via HydrateClient.
 */

import { trpc } from "@/src/lib/trpc/server";

export function prefetchDashboard() {
  void trpc.project.getDashboardInfo.queryOptions();
  void trpc.project.getAll.queryOptions();
  void trpc.project.getRecentActivity.queryOptions();
  void trpc.project.getCommitChart.queryOptions();
}
