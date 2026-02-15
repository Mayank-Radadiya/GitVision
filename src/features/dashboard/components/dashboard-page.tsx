"use client";

/**
 * Dashboard page orchestrator — the root client component.
 *
 * Architecture:
 * - Subscribes to useDashboardInfo() only (for stats)
 * - Composes isolated sections that manage their own data:
 *   • DashboardHeader → useUser()
 *   • ProjectList → useUserProjects()
 *   • ActivityFeed → useRecentActivity()
 *   • CommitChart → useCommitChart()
 *
 * This separation prevents cross-concern rerenders:
 * project list changes → only ProjectList rerenders, not the header or stats.
 */

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useDashboardInfo } from "@/features/dashboard/hooks/use-dashboard";
import DashboardHeader from "./dashboard-header";
import ProjectList from "./project-list/project-list";
import ActivityFeed from "./activity-feed/activity-feed";
import CommitChart from "./commit-chart";

export default function DashboardPage() {
  const { data: stats, isError } = useDashboardInfo();

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load dashboard data. Please refresh.");
    }
  }, [isError]);

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header + Stats */}
      <DashboardHeader stats={stats} />

      {/* Main Content: 2-column on desktop */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Project List (takes 2/3 width) */}
        <div className="lg:col-span-2">
          <ProjectList />
        </div>

        {/* Right: Activity Feed + Chart (takes 1/3 width) */}
        <div className="space-y-6">
          <CommitChart />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
