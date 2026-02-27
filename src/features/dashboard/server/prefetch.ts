/**
 * Server-side prefetch for dashboard data.
 * Single consolidated call — replaces the previous 7 separate prefetches.
 */

import { prefetch, trpc } from "@/src/lib/trpc/server";

export function prefetchDashboard() {
  return prefetch(trpc.project.getDashboardData.queryOptions());
}
