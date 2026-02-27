"use client";

/**
 * Dashboard page orchestrator — the root client component.
 *
 * Layout: Header → Stats → 2-column grid (Projects 60% | Insights 40%)
 * Centered with max-w for ultrawide screens.
 */

import { useEffect } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { useDashboardInfo } from "@/features/dashboard/hooks/use-dashboard";
import DashboardHeader from "./dashboard-header";
import ProjectList from "./project-list/project-list";
import CommitChart from "./commit-chart";
import LanguageBreakdown from "./language-breakdown";
import NeedsAttention from "./needs-attention";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export default function DashboardPage() {
  const { data: stats, isError } = useDashboardInfo();

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load dashboard data. Please refresh.");
    }
  }, [isError]);

  return (
    <motion.div
      className="mx-auto min-h-screen max-w-[1400px] p-5 lg:p-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header + Stats */}
      <motion.div variants={staggerItem}>
        <DashboardHeader stats={stats} />
      </motion.div>

      {/* Main Content: 2-column on desktop */}
      <motion.div
        variants={staggerItem}
        className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-5"
      >
        {/* Left: Project List (3/5 width) */}
        <div className="lg:col-span-3">
          <ProjectList />
        </div>

        {/* Right: Insights Column (2/5 width) */}
        <div className="space-y-5 lg:col-span-2">
          <CommitChart />
          <LanguageBreakdown />
          <NeedsAttention />
        </div>
      </motion.div>
    </motion.div>
  );
}
