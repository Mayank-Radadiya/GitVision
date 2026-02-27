"use client";

/**
 * Dashboard header — greeting with date, quick actions.
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

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-5">
      {/* Greeting + Actions */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Welcome back, {firstName}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-0.5 text-sm text-muted-foreground"
          >
            {today}
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
