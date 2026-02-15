"use client";

/**
 * Stats bento grid — renders 4 stat cards (or skeletons) in a responsive grid.
 * Receives stats data as props from the parent orchestrator.
 */

import { memo } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { STAT_CARDS } from "@/features/dashboard/constants/dashboard.constants";
import type { DashboardStats } from "@/features/dashboard/types/dashboard.types";
import StatCard from "./stat-card";

interface StatsSectionProps {
  stats: DashboardStats | undefined;
}

function StatsSection({ stats }: StatsSectionProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((c) => (
          <Skeleton key={c.label} className="h-[120px] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {STAT_CARDS.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.getValue(stats)}
          icon={card.icon}
          color={card.color}
          description={card.description}
        />
      ))}
    </div>
  );
}

export default memo(StatsSection);
