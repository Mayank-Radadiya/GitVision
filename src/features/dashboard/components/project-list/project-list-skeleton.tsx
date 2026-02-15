/**
 * Skeleton loading state for the project list.
 * Pure presentational — memoized to prevent unnecessary rerenders.
 */

import { memo } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { SKELETON_COUNT } from "@/features/dashboard/constants/dashboard.constants";

function ProjectListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-2xl border border-border/40 bg-card/50 p-5"
        >
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

export default memo(ProjectListSkeleton);
