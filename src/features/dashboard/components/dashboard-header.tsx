"use client";

/**
 * Dashboard header — greeting, quick actions, and stats grid.
 * Subscribes to useUser() — user info changes don't rerender the project list.
 */

import { memo } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import StatsSection from "./stats-section/stats-section";
import QuickActions from "./quick-actions";
import type { DashboardStats } from "@/features/dashboard/types/dashboard.types";

interface DashboardHeaderProps {
  stats: DashboardStats | undefined;
}

function DashboardHeader({ stats }: DashboardHeaderProps) {
  const { user } = useUser();
  const firstName = user?.firstName || "there";

  return (
    <div className="space-y-6">
      {/* Greeting + Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Welcome back, {firstName}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-1 text-sm text-muted-foreground"
          >
            Here&apos;s an overview of your repositories
          </motion.p>
        </div>
        <QuickActions />
      </div>

      {/* Stats Grid */}
      <StatsSection stats={stats} />
    </div>
  );
}

export default memo(DashboardHeader);
